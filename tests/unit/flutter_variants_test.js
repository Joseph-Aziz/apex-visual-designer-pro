/* Unit tests for js/flutter-variants.js. Run: node TESTS/flutter_variants_test.js */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const window = {};
const ctx = { window, JSON };
['plugin/files/js/look-selectors.js', 'plugin/files/js/component-registry.js', 'plugin/files/js/flutter-variants.js'].forEach((f) =>
  vm.runInNewContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f }));
const F = window.VD.flutterVariants;
assert.ok(F, 'VD.flutterVariants is undefined');

const defaults = (v) => v.params.reduce((o, p) => (o[p.key] = p.default, o), {});

// every type keeps v1..v6; some types add more looks; ids are unique
assert.deepStrictEqual(Array.from(F.types),
  ['text', 'date', 'select', 'choice', 'switch', 'button', 'display', 'region', 'classic', 'ir', 'ig', 'cards', 'chart']);
F.types.filter((t) => t !== 'chart').forEach((t) => {
  const ids = F.forType(t).map((v) => v.id);
  assert.strictEqual(ids.slice(0, 6).join(), 'v1,v2,v3,v4,v5,v6', t + ' variant ids');
  assert.strictEqual(new Set(ids).size, ids.length, t + ' unique ids');
});
['region', 'button', 'cards', 'choice', 'date'].forEach((t) => {
  const last = F.forType(t)[F.forType(t).length - 1];
  assert.deepStrictEqual([last.id, last.label], ['v7', 'Dashboard'], t + ' dashboard look');
});

// looks v1..v6 render exactly as before
const snap = JSON.parse(fs.readFileSync('tests/unit/fixtures/variants_v1_v6.json', 'utf8'));
Object.keys(snap).forEach((k) => {
  const [t, id] = k.split(':'), v = F.get(t, id);
  assert.strictEqual(v.css('#X1', F.values(v, {})), snap[k], k + ' changed');
});

// labels match spec table
const labels = (t) => F.forType(t).map((v) => v.label).join('|');
assert.strictEqual(labels('text'), 'Filled|Outlined|Soft|Underline|Glass|Pill');
assert.strictEqual(labels('button'), 'Filled|Tonal|Outlined|Elevated|Text|Gradient|Dashboard');
assert.strictEqual(labels('region'), 'Elevated card|Outlined card|Flat|Tonal|Glass|Accent bar|Dashboard');
assert.strictEqual(labels('choice'), 'Material|Chip|Card|Segmented|Pill|List tile|Dashboard');
assert.strictEqual(labels('switch'), 'Material|iOS|Labelled pill|Square|Thin track|Outline');
['classic', 'ir', 'ig'].forEach((r) => assert.strictEqual(labels(r), 'Material table|Striped|Dense|Card rows|Borderless|Accent header'));
assert.strictEqual(labels('cards'), 'Elevated|Outlined|Media|Tonal|Glass|Accent top|Dashboard');
assert.strictEqual(labels('date'), 'Filled|Outlined|Soft|Underline|Glass|Pill|Dashboard');
assert.strictEqual(labels('text'), 'Filled|Outlined|Soft|Underline|Glass|Pill');
assert.strictEqual(F.forType('chart').length, 0, 'charts are styled by the Chart Designer, not looks');
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
const iconKeys = (t, id) => F.get(t, id).params.filter((p) => p.section === 'icon').map((p) => p.key).join();
assert.strictEqual(iconKeys('select', 'v1'), 'iconStyle,iconSize,iconColor,iconHoverBg,iconPosition', 'select icon section');
assert.strictEqual(iconKeys('date', 'v3'), 'iconStyle,iconSize,iconColor,iconHoverBg,iconPosition,stepArrows', 'date icon section');
assert.strictEqual(iconKeys('text', 'v1'), '', 'text has no icon section');
// date calendar arrows: own section; header is a flex row with the title centred
{
  const arrowKeys = F.get('date', 'v2').params.filter((p) => p.section === 'arrows').map((p) => p.key).join();
  assert.strictEqual(arrowKeys, 'navIcon,navSize,navColor,navBg,navHoverBg,navHoverColor,navShape,navBorder', 'date arrows section');
  const v = F.get('date', 'v2');
  const css = v.css('#P1_D_CONTAINER', F.values(v, { stepArrows: 'on', navColor: '#ff0000', navShape: 'square', navSize: 22 }));
  assert.ok(/\.a-DatePicker-header \{[^}]*display:flex[^}]*justify-content:space-between/.test(css), 'header flex row');
  assert.ok(/\.a-DatePicker-selectors \{[^}]*order:1[^}]*justify-content:center/.test(css), 'title centred');
  assert.ok(/\.a-DatePicker-next \{[^}]*order:2/.test(css), 'next at the end');
  assert.ok(css.includes('color:#ff0000') && css.includes('border-radius:0;') && css.includes('inline-size:22px'), 'arrow settings applied');
  assert.ok(/a-DatePicker-previous:dir\(rtl\)::after \{ transform:rotate\(-90deg\)/.test(css), 'rtl turns the glyph');
  assert.ok(/\.vd-fl-step-next::after \{[^}]*rotate\(-90deg\)/.test(css) && css.includes('.vd-fl-step { font-size:0; }'), 'day arrows styled too');
  assert.ok(!F.get('date', 'v2').css('#X', F.values(v, { navIcon: 'none' })).includes('a-DatePicker-previous::after'), 'none keeps APEX glyph');
}
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
const depVals = F.get('date', 'v1');
assert.ok(depVals.css('#X1', F.values(depVals, { iconStyle: 'clock' })).includes(encodeURIComponent('M12 7v5l3 2')), 'clock shape');

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
assert.strictEqual(F.typeOf({ kind: 'region', type: 'NATIVE_JET_CHART' }), 'chart');
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
  const keys = v.params.filter((p) => p.section === 'advanced' || ['hover', 'focus'].includes(p.state)).map((p) => p.key);
  // Ripple on press is offered only by the designs that have a ripple.
  assert.strictEqual(keys.join(), ADV.filter((k) => k !== 'ripple' || v.needsJs).join(), t + v.id + ' advanced keys');
  v.params.filter((p) => p.section === 'advanced').forEach((p) => assert.strictEqual(p.default, '', t + v.id + p.key + ' default'));
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
const hideKeys = (t) => F.get(t, 'v1').params.filter((p) => p.section === 'hide').map((p) => p.key).join();
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

// dashboard looks
const dash = (t) => { const v = F.get(t, 'v7'); return v.css('#X1', F.values(v, {})); };
const reg = dash('region');
['1px solid #e2e8f0', 'border-radius:16px', 'rgba(15,23,42,.05)', '#0f172a', 'Cairo'].forEach((x) => assert.ok(reg.includes(x), 'region dashboard ' + x));
const db = dash('button');
['background:#0f766e', 'border-radius:8px', 'font-size:12px', 'font-weight:700', 'padding-block:6px', 'padding-inline:14px'].forEach((x) => assert.ok(db.includes(x), 'button dashboard ' + x));
const dc = dash('cards');
assert.ok(/a-CardView-title[^{]*\{[^}]*color:#0f766e[^}]*font-size:26px/.test(dc), 'cards main value teal 26px');
assert.ok(/a-CardView-subTitle[^{]*\{[^}]*color:#2563eb/.test(dc), 'cards second value blue');
assert.ok(/a-CardView-subTitle:empty[^{]*\{[^}]*display:none/.test(dc), 'empty second value takes no room');
const ch = dash('choice');
assert.ok(/\.apex-item-radio[^{]*input:checked \+ label[^{]*\{[^}]*background:#0f766e/.test(ch), 'radio segmented teal');
assert.ok(/\.apex-item-checkbox[^{]*label[^{]*\{[^}]*border-radius:20px/.test(ch), 'checkbox pills');
const dd = dash('date');
assert.ok(dd.includes('#e2e8f0') && dd.includes('border-radius:'), 'date dashboard');
['region', 'button', 'cards', 'choice', 'date'].forEach((t) => assert.strictEqual(F.get(t, 'v7').font, 'cairo', t + ' dashboard font'));

assert.strictEqual(F.get('region', 'v1').js, undefined, 'other looks have no js');

// The library lives in the component registry; VD.flutterVariants reads from it.
{
  const R = window.VD.componentRegistry;
  assert.strictEqual(Array.from(R.families().map((f) => f.id)).join(' '), Array.from(F.types).join(' '), 'one family per type, in the same order');
  assert.strictEqual(Array.from(F.types).join(' '), 'text date select choice switch button display region classic ir ig cards chart');
  F.types.forEach((t) => {
    assert.strictEqual(F.forType(t).length, R.family(t).variants.length, t + ' designs');
    F.forType(t).forEach((v) => assert.strictEqual(F.get(t, v.id), R.variant(t, v.id), t + ' ' + v.id));
  });
  const cat = {}; R.categories().forEach((c) => { cat[c.id] = Array.from(c.families.map((f) => f.id)).join(' '); });
  assert.strictEqual(cat.form, 'text date select');
  assert.strictEqual(cat.selection, 'choice switch');
  assert.strictEqual(cat.action, 'button');
  assert.strictEqual(cat.display, 'display');
  assert.strictEqual(cat.region, 'region cards chart');
  assert.strictEqual(cat.report, 'classic ir ig');
  const members = (id) => Array.from(R.family(id).members.map((m) => m.label)).join(', ');
  assert.strictEqual(members('text'), 'Text Field, Textarea, Number Field, Password');
  assert.strictEqual(members('select'), 'Select List, Popup LOV, Combobox');
  assert.strictEqual(members('choice'), 'Checkbox Group, Radio Group, Checkbox');
  assert.strictEqual(R.family('chart').editor, 'chart', 'charts have their own designer and no designs');
  assert.strictEqual(R.family('text').plural, 'Text fields');

  // a design added from outside the library file shows up everywhere the library is read
  const before = F.forType('display').length;
  R.registerVariant('display', { id: 'x1', label: 'Extra', params: [], css: (sel) => 'body ' + sel + ' { color:red }' });
  assert.strictEqual(F.forType('display').length, before + 1);
  assert.strictEqual(F.get('display', 'x1').label, 'Extra');
}

{
// ---- settings schema: bounds, sections and dependencies
const bounded = { key: 'gap', label: 'Gap', kind: 'px', default: 8, min: 4, max: 20 };
assert.strictEqual(F.cleanParam(bounded, '10'), 10, 'inside the bounds');
assert.strictEqual(F.cleanParam(bounded, '4'), 4, 'min is allowed');
assert.strictEqual(F.cleanParam(bounded, '20'), 20, 'max is allowed');
assert.strictEqual(F.cleanParam(bounded, '3'), null, 'below min');
assert.strictEqual(F.cleanParam(bounded, '21'), null, 'above max');
assert.strictEqual(F.cleanParam(Object.assign({}, bounded, { kind: 'number' }), '25'), null, 'number bounds');
const dep = { id: 'dep', label: 'Dep', css: () => '', params: [
  { key: 'mode', label: 'Mode', kind: 'select', options: ['a', 'b', 'c'], default: 'a' },
  bounded,
  { key: 'gapB', label: 'Gap B', kind: 'px', default: '', dependsOn: { key: 'mode', equals: 'b' } },
  { key: 'gapBC', label: 'Gap BC', kind: 'px', default: '', dependsOn: { key: 'mode', oneOf: ['b', 'c'] } }] };
assert.strictEqual(F.values(dep, { gap: 30 }).gap, 8, 'out of bounds falls back to the default');
let depVals = F.values(dep, { mode: 'a', gapB: 6, gapBC: 7 });
assert.strictEqual(depVals.gapB, '', 'dependency false: value ignored');
assert.strictEqual(depVals.gapBC, '', 'oneOf false: value ignored');
depVals = F.values(dep, { mode: 'c', gapB: 6, gapBC: 7 });
assert.strictEqual(depVals.gapB, '', 'equals b, mode c');
assert.strictEqual(depVals.gapBC, 7, 'oneOf true');
assert.strictEqual(F.values(dep, { mode: 'b', gapB: 6 }).gapB, 6, 'equals true');
assert.strictEqual(F.active(dep, dep.params[2], { mode: 'b' }), true);
assert.strictEqual(F.active(dep, dep.params[2], { mode: 'a' }), false);
// the registry checks the new fields
const bad = (params) => assert.throws(() => window.VD.componentRegistry.registerVariant('display', { id: 'bad', label: 'Bad', css: () => '', params }));
bad([{ key: 'x', label: 'X', kind: 'px', default: '', min: 10, max: 2 }]);
bad([{ key: 'x', label: 'X', kind: 'select', options: ['a'], default: '', min: 1 }]);
bad([{ key: 'x', label: 'X', kind: 'px', default: '', section: 'nowhere' }]);
bad([{ key: 'x', label: 'X', kind: 'px', default: '', dependsOn: { key: 'missing', equals: 'a' } }]);
bad([{ key: 'm', label: 'M', kind: 'select', options: ['a'], default: 'a' }, { key: 'x', label: 'X', kind: 'px', default: '', dependsOn: { key: 'm' } }]);
}

// ---- state settings: empty by default, one scoped rule each when set
{
  const rules = (css) => (css.match(/\{/g) || []).length;
  const STATE_KEYS = { hover: ['hoverBg'], focus: ['focusColor', 'focusWidth'], disabled: ['disabledOpacity', 'disabledBg'],
    readonly: ['readonlyBg', 'readonlyText'], error: ['errorColor'] };
  const sample = { hoverBg: '#111111', focusColor: '#222222', focusWidth: 3, disabledOpacity: 0.5, disabledBg: '#333333',
    readonlyBg: '#444444', readonlyText: '#555555', errorColor: '#666666' };
  const want = { text: ['hover', 'focus', 'disabled', 'readonly', 'error'], select: ['hover', 'focus', 'disabled', 'readonly', 'error'],
    choice: ['hover', 'focus', 'disabled', 'error'], button: ['hover', 'focus', 'disabled'], region: ['hover', 'focus'] };
  Object.keys(want).forEach((type) => {
    const v = F.forType(type)[0];
    const st = v.params.filter((p) => p.state);
    assert.deepStrictEqual([...new Set(st.map((p) => p.state))], want[type], type + ' states in order');
    st.forEach((p) => {
      assert.strictEqual(p.section, 'state', p.key + ' in the States section');
      assert.strictEqual(p.default, '', p.key + ' empty by default');
      assert.deepStrictEqual(STATE_KEYS[p.state].includes(p.key), true, p.key + ' belongs to ' + p.state);
    });
    const base = v.css('#X', F.values(v, {}));
    st.forEach((p) => {
      const one = v.css('#X', F.values(v, { [p.key]: sample[p.key] }));
      assert.strictEqual(rules(one), rules(base) + 1, type + ' ' + p.key + ' adds exactly one rule');
      assert.ok(one.startsWith(base) || one.includes(String(sample[p.key])), type + ' ' + p.key + ' uses its value');
    });
  });
  const t = F.forType('text')[0], b = F.forType('button')[0];
  assert.ok(t.css('#X', F.values(t, { disabledOpacity: 0.5 })).includes('.apex_disabled'), 'disabled targets apex_disabled');
  assert.ok(b.css('#X', F.values(b, { disabledBg: '#333333' })).includes(':disabled'), 'button disabled targets :disabled');
  assert.ok(t.css('#X', F.values(t, { readonlyBg: '#444444' })).includes('[readonly]'), 'read-only targets [readonly]');
  assert.ok(t.css('#X', F.values(t, { errorColor: '#666666' })).includes('.apex-page-item-error'), 'error targets the error class');
  assert.strictEqual(F.cleanParam(t.params.filter((p) => p.key === 'disabledOpacity')[0], '1.5'), null, 'opacity above 1 rejected');
  const badS = (params) => assert.throws(() => window.VD.componentRegistry.registerVariant('display', { id: 'bad2', label: 'Bad', css: () => '', params }));
  badS([{ key: 'x', label: 'X', kind: 'color', default: '', section: 'state', state: 'pressed' }]);
  badS([{ key: 'x', label: 'X', kind: 'color', default: '#fff', section: 'state', state: 'hover' }]);
}

console.log('flutter_variants_test: all passed');

// label inside the box: label and input share one grid cell; the input makes room at the top
{
  ['text', 'date', 'select'].forEach((t) => F.forType(t).forEach((v) =>
    assert.ok(v.params.some((p) => p.key === 'labelPosition'), t + v.id + ' has labelPosition')));
  const v = F.get('text', 'v2');
  assert.ok(!/grid-area:1 \/ 1/.test(v.css('#C', F.values(v, {}))), 'above by default');
  const css = v.css('#C', F.values(v, { labelPosition: 'inside' }));
  assert.ok(/body #C \.t-Form-labelContainer, body #C \.t-Form-inputContainer \{ grid-area:1 \/ 1;/.test(css), 'same cell');
  assert.ok(/\.t-Form-labelContainer \{[^}]*pointer-events:none/.test(css), 'label lets clicks through');
  assert.ok(/padding-block-start:\d+px; padding-block-end/.test(css), 'input room for the label');
  console.log('label inside: ok');
}
