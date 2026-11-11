/* Unit tests for js/flutter-variants.js. Run: node TESTS/flutter_variants_test.js */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const window = {};
const ctx = { window, JSON };
['plugin/files/js/look-selectors.js', 'plugin/files/js/flutter-variants.js'].forEach((f) =>
  vm.runInNewContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f }));
const F = window.VD.flutterVariants;
assert.ok(F, 'VD.flutterVariants is undefined');

const defaults = (v) => v.params.reduce((o, p) => (o[p.key] = p.default, o), {});

// every type has six variants v1..v6
assert.deepStrictEqual(Array.from(F.types),
  ['text', 'date', 'select', 'choice', 'switch', 'button', 'display', 'region', 'classic', 'ir', 'ig', 'cards']);
F.types.forEach((t) => {
  assert.deepStrictEqual(F.forType(t).map((v) => v.id).join(), 'v1,v2,v3,v4,v5,v6', t + ' variant ids');
});

// labels match spec table
const labels = (t) => F.forType(t).map((v) => v.label).join('|');
assert.strictEqual(labels('text'), 'Filled|Outlined|Soft|Underline|Glass|Pill');
assert.strictEqual(labels('button'), 'Filled|Tonal|Outlined|Elevated|Text|Gradient');
assert.strictEqual(labels('region'), 'Elevated card|Outlined card|Flat|Tonal|Glass|Accent bar');
assert.strictEqual(labels('choice'), 'Material|Chip|Card|Segmented|Pill|List tile');
assert.strictEqual(labels('switch'), 'Material|iOS|Labelled pill|Square|Thin track|Outline');
['classic', 'ir', 'ig'].forEach((r) => assert.strictEqual(labels(r), 'Material table|Striped|Dense|Card rows|Borderless|Accent header'));
assert.strictEqual(labels('cards'), 'Elevated|Outlined|Media|Tonal|Glass|Accent top');
assert.strictEqual(labels('display'), 'Plain|Chip|Tile|Badge|Outlined|Large value');

// css() output is scoped, and uses no physical left/right properties
const physical = /\b(margin|padding|border)-(left|right)\b|(^|[;{\s])(left|right)\s*:/;
F.types.forEach((t) => F.forType(t).forEach((v) => {
  const css = v.css('#X1', defaults(v));
  assert.ok(css.trim().length > 0, t + v.id + ' empty');
  css.split('}').map((r) => r.trim()).filter(Boolean).forEach((rule) => {
    const sel = rule.split('{')[0];
    if (sel.trim().startsWith('@')) return;
    sel.split(',').forEach((s) => assert.ok(s.trim().startsWith('body #X1'), t + v.id + ' unscoped: ' + s));
  });
  assert.ok(!physical.test(css), t + v.id + ' uses physical left/right');
}));
assert.ok(F.get('text', 'v2').css('#P1_A_CONTAINER', defaults(F.get('text', 'v2'))).includes('body #P1_A_CONTAINER'));

// floating labels: the container itself carries the floating-label class, so every field shape
// must target it as a compound selector and keep the value clear of the label
['v1', 'v2', 'v3', 'v4', 'v5', 'v6'].forEach((id) => {
  const css = F.get('text', id).css('#X1', defaults(F.get('text', id)));
  assert.ok(css.includes('body #X1.t-Form-fieldContainer--floatingLabel .t-Form-label'), 'text ' + id + ' floating label');
  assert.ok(!css.includes('body #X1 .t-Form-fieldContainer--floatingLabel'), 'text ' + id + ' floating label as descendant');
});

// smooth icons inside the field: chevron for lists (popup LOV and native select), calendar for dates
['v1', 'v2', 'v3', 'v4', 'v5', 'v6'].forEach((id) => {
  const sel = F.get('select', id).css('#X1', defaults(F.get('select', id)));
  assert.ok(sel.includes('body #X1 .a-Button--popupLOV::after'), 'select ' + id + ' chevron');
  assert.ok(sel.includes('-webkit-mask:'), 'select ' + id + ' chevron is a mask');
  assert.ok(sel.includes("[aria-expanded=\"true\"]"), 'select ' + id + ' chevron turns when open');
  assert.ok(sel.includes('body #X1 select:dir(rtl)'), 'select ' + id + ' native arrow follows RTL');
  const date = F.get('date', id).css('#X1', defaults(F.get('date', id)));
  assert.ok(date.includes('body #X1 .a-Button--calendar::after'), 'date ' + id + ' calendar icon');
  assert.ok(!F.get('text', id).css('#X1', defaults(F.get('text', id))).includes('::after'), 'text ' + id + ' has no icon');
});
const icoColor = F.get('select', 'v1').css('#X1', Object.assign(defaults(F.get('select', 'v1')), { icon: '#ff0000' }));
assert.ok(icoColor.includes('%23ff0000'), 'native select arrow uses the icon colour');

// own Icon section for dates and lists (and nothing for plain text fields)
const iconKeys = (t, id) => F.get(t, id).params.filter((p) => p.group === 'icon').map((p) => p.key).join();
assert.strictEqual(iconKeys('select', 'v1'), 'iconStyle,iconSize,iconColor,iconHoverBg,iconPosition', 'select icon section');
assert.strictEqual(iconKeys('date', 'v3'), 'iconStyle,iconSize,iconColor,iconHoverBg,iconPosition', 'date icon section');
assert.strictEqual(iconKeys('text', 'v1'), '', 'text has no icon section');
assert.strictEqual(F.get('select', 'v1').params.find((p) => p.key === 'iconStyle').options.join(), 'chevron,caret,arrow,none');
assert.strictEqual(F.get('date', 'v1').params.find((p) => p.key === 'iconStyle').options.join(), 'calendar,event,clock,none');
const sv = F.get('select', 'v2');
const ic = sv.css('#X1', F.values(sv, { iconSize: 24, iconColor: '#ff0000', iconHoverBg: '#00ff00', iconPosition: 'start', iconStyle: 'caret' }));
assert.ok(ic.includes('inline-size:24px; block-size:24px'), 'icon size');
assert.ok(/a-Button--popupLOV::after \{[^}]*background:#ff0000/.test(ic), 'icon colour');
assert.ok(/a-Button--popupLOV:hover \{[^}]*background:#00ff00/.test(ic), 'icon hover background');
assert.ok(/a-Button--popupLOV \{[^}]*inset-inline-start:/.test(ic), 'icon at the start');
assert.ok(ic.includes(encodeURIComponent('M7 10h10l-5 6z')), 'caret shape');
const none = sv.css('#X1', F.values(sv, { iconStyle: 'none' }));
assert.ok(/a-Button--popupLOV::after \{[^}]*display:none/.test(none), 'icon hidden');
assert.ok(/select \{[^}]*background-image:none/.test(none), 'native arrow hidden');
const dv = F.get('date', 'v1');
assert.ok(dv.css('#X1', F.values(dv, { iconStyle: 'clock' })).includes(encodeURIComponent('M12 7v5l3 2')), 'clock shape');

// cleanParam rejects injection
assert.strictEqual(F.cleanParam({ kind: 'color' }, 'red;}</style>'), null);
assert.strictEqual(F.cleanParam({ kind: 'px' }, '12'), 12);
assert.strictEqual(F.cleanParam({ kind: 'px' }, '12px;}'), null);
assert.strictEqual(F.cleanParam({ kind: 'color' }, '#1a73e8'), '#1a73e8');
assert.strictEqual(F.cleanParam({ kind: 'weight' }, '600'), 600);
assert.strictEqual(F.cleanParam({ kind: 'icon' }, 'fa-calendar'), 'fa-calendar');
assert.strictEqual(F.cleanParam({ kind: 'icon' }, 'fa-x"}'), null);

// typeOf maps component types
assert.strictEqual(F.typeOf({ kind: 'item', type: 'NATIVE_DATE_PICKER_APEX' }), 'date');
assert.strictEqual(F.typeOf({ kind: 'item', type: 'NATIVE_DATEPICKER_APEX' }), 'date');
assert.strictEqual(F.typeOf({ kind: 'item', type: 'NATIVE_YES_NO' }), 'switch');
assert.strictEqual(F.typeOf({ kind: 'item', type: 'NATIVE_TEXT_FIELD' }), 'text');
assert.strictEqual(F.typeOf({ kind: 'item', type: 'NATIVE_POPUP_LOV' }), 'select');
assert.strictEqual(F.typeOf({ kind: 'item', type: 'NATIVE_RADIOGROUP' }), 'choice');
assert.strictEqual(F.typeOf({ kind: 'item', type: 'NATIVE_DISPLAY_ONLY' }), 'display');
assert.strictEqual(F.typeOf({ kind: 'item', type: 'PLUGIN_SOMETHING' }), null);
['classic', 'ir', 'ig'].forEach((c) => assert.strictEqual(F.typeOf({ kind: 'region', component: c }), c));
assert.strictEqual(F.typeOf({ kind: 'region', type: 'NATIVE_CARDS' }), 'cards');
assert.strictEqual(F.typeOf({ kind: 'region', type: 'NATIVE_STATIC' }), 'region');
assert.strictEqual(F.typeOf({ kind: 'button' }), 'button');

// needsJs true only for ripple variants
F.types.forEach((t) => F.forType(t).forEach((v) => {
  const expect = t === 'button' || (t === 'choice' && (v.id === 'v2' || v.id === 'v5'));
  assert.strictEqual(v.needsJs, expect, t + v.id + ' needsJs');
}));

// advanced settings: every variant has them, they are empty by default and add no css
const ADV = ['shadow', 'hoverBg', 'focusColor', 'focusWidth', 'fontFamily', 'letterSpacing', 'textTransform',
  'lineHeight', 'width', 'maxWidth', 'marginBlock', 'align', 'motion', 'ripple', 'customCss'];
F.types.forEach((t) => F.forType(t).forEach((v) => {
  const keys = v.params.filter((p) => p.group === 'advanced').map((p) => p.key);
  assert.strictEqual(keys.join(), ADV.join(), t + v.id + ' advanced keys');
  v.params.filter((p) => p.group === 'advanced').forEach((p) => assert.strictEqual(p.default, '', t + v.id + p.key + ' default'));
}));
const tv = F.get('text', 'v1');
const plain = tv.css('#X1', F.values(tv, {}));
assert.ok(!plain.includes('font-family'), 'no advanced css when unset');
const adv = tv.css('#X1', F.values(tv, { shadow: 'lg', hoverBg: '#ff0000', focusColor: '#00ff00', focusWidth: 3,
  fontFamily: 'cairo', letterSpacing: '0.5', textTransform: 'uppercase', lineHeight: '1.6', width: 'full',
  maxWidth: 480, marginBlock: 8, align: 'center', motion: 'off', customCss: 'opacity:.9; cursor:pointer' }));
['box-shadow:0 8px 24px', 'background:#ff0000', 'outline:3px solid #00ff00', 'font-family:Cairo', 'letter-spacing:0.5px',
  'text-transform:uppercase', 'line-height:1.6', 'inline-size:100%', 'max-inline-size:480px', 'margin-block:8px',
  'text-align:center', 'transition:none', 'opacity:.9; cursor:pointer'].forEach((x) => assert.ok(adv.includes(x), 'advanced css has ' + x));
adv.split('}').map((r) => r.trim()).filter(Boolean).forEach((r) =>
  r.split('{')[0].split(',').forEach((s) => assert.ok(s.trim().startsWith('body #X1'), 'advanced unscoped: ' + s)));
assert.ok(!physical.test(adv), 'advanced uses physical left/right');
const bv = F.get('button', 'v1');
assert.ok(bv.css('#B1', F.values(bv, { hoverBg: '#123456' })).includes('body #B1:hover'), 'button hover on the button itself');

// text alignment reaches the element that holds the text, not only the wrapper
const rulesOf = (css) => css.split('}').map((r) => r.trim()).filter(Boolean);
const alignText = rulesOf(tv.css('#X1', F.values(tv, { align: 'center' })));
assert.ok(alignText.some((r) => r.includes('input.text_field') && r.includes('text-align:center')), 'text align on the input');
const alignBtn = bv.css('#B1', F.values(bv, { align: 'end' }));
assert.ok(alignBtn.includes('justify-content:flex-end'), 'button align moves its content');

// new kinds: select (whitelisted options) and css (declarations only)
const sel = tv.params.find((p) => p.key === 'shadow');
assert.strictEqual(F.cleanParam(sel, 'md'), 'md');
assert.strictEqual(F.cleanParam(sel, 'huge'), null);
const cc = tv.params.find((p) => p.key === 'customCss');
assert.strictEqual(F.cleanParam(cc, 'color:red; opacity:.5'), 'color:red; opacity:.5');
['a{b}', 'x</style>', '@import x', 'background:url(http://e)', 'width:expression(1)', 'color:red /* x', 'a:b */', 'content:"\\62"'].forEach((bad) =>
  assert.strictEqual(F.cleanParam(cc, bad), null, 'customCss rejects ' + bad));
assert.strictEqual(F.cleanParam({ kind: 'number' }, '0.5'), 0.5);
assert.strictEqual(F.googleFont('cairo'), 'Cairo');
assert.strictEqual(F.googleFont('system'), null);

// each report family only styles its own markup
const irCss = F.get('ir', 'v2').css('#r', F.values(F.get('ir', 'v2'), {}));
assert.ok(irCss.includes('.a-IRR') && !irCss.includes('.a-GV') && !irCss.includes('.t-Report-report'), 'ir css is ir only');
const igCss = F.get('ig', 'v1').css('#r', F.values(F.get('ig', 'v1'), {}));
assert.ok(igCss.includes('.a-GV') && !igCss.includes('.a-IRR'), 'ig css is ig only');

// show / hide switches
const hideKeys = (t) => F.get(t, 'v1').params.filter((p) => p.group === 'hide').map((p) => p.key).join();
assert.strictEqual(hideKeys('ir'), 'hideSearch,hideActions,hideRowsPerPage,hideReset,hideColumnMenu,hidePagination,hideSettingsBar,hideTitle,hideRegionButtons');
assert.strictEqual(hideKeys('ig'), 'hideToolbar,hideSearch,hideActions,hideEditSave,hideFooter,hideTitle,hideRegionButtons');
assert.strictEqual(hideKeys('classic'), 'hidePagination,hideNoData,hideHeadings,hideTitle,hideRegionButtons');
assert.strictEqual(hideKeys('cards'), 'hidePagination,hideNoData,hideTitle,hideRegionButtons');
assert.strictEqual(hideKeys('region'), 'hideTitle,hideRegionButtons');
['text', 'date', 'select', 'choice', 'switch', 'display'].forEach((t) => assert.strictEqual(hideKeys(t), 'hideLabel,hideHelp,hideRequired', t));
assert.strictEqual(hideKeys('button'), 'hideIcon,hideLabel');
const ir = F.get('ir', 'v1');
const hp = ir.params.find((p) => p.key === 'hideActions');
assert.deepStrictEqual([hp.kind, hp.default, hp.options.join()], ['select', '', 'show,hide']);
assert.strictEqual(F.cleanParam(hp, 'gone'), null);
assert.ok(!ir.css('#r', F.values(ir, { hideActions: 'show' })).includes('display:none'), 'show emits nothing');
assert.ok(/body #r .a-IRR-actions[^{]*{ display:none/.test(ir.css('#r', F.values(ir, { hideActions: 'hide' }))), 'hide actions');
const btnH = F.get('button', 'v1');
assert.ok(/body #b .t-Button-label[^{]*{ display:none/.test(btnH.css('#b', F.values(btnH, { hideLabel: 'hide' }))), 'hide button label');
const txH = F.get('text', 'v1');
assert.ok(/body #i .t-Form-labelContainer[^{]*{ display:none/.test(txH.css('#i', F.values(txH, { hideLabel: 'hide' }))), 'hide item label');

console.log('flutter_variants_test: all passed');
