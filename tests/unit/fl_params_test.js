/* Unit tests for js/fl-params.js. Run: node TESTS/fl_params_test.js */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const window = {};
const ctx = { window, JSON };
['plugin/files/js/look-selectors.js', 'plugin/files/js/component-registry.js', 'plugin/files/js/flutter-variants.js', 'plugin/files/js/fl-params.js'].forEach((f) =>
  vm.runInNewContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f }));
const V = window.VD.flutterVariants, P = window.VD.flParams;
assert.ok(P, 'VD.flParams is undefined');

const date = P.html(V.get('date', 'v1'), {}, {});
assert.ok(date.includes('fl-icon-section'), 'date has the icon section');
assert.ok(date.includes('fl-hide-section'), 'date has the show/hide section');
assert.ok(date.includes('data-param="hideLabel"'), 'date has the label switch');
assert.ok(!P.html(V.get('button', 'v1'), {}, {}).includes('fl-icon-section'), 'button has no icon section');
assert.ok(P.html(V.get('ir', 'v1'), {}, { hide: true }).includes('fl-hide-section" open'), 'hide section open state');
assert.ok(P.html(V.get('ir', 'v1'), {}, { advanced: true }).includes('fl-adv-section" open'), 'advanced open state');
assert.ok(!P.html(V.get('text', 'v1'), { accent: '"><script>x</script>' }, {}).includes('<script>'), 'values are escaped');
assert.ok(P.sample('ir').includes('a-IRR-table'), 'ir sample');
assert.ok(P.sample('text').includes('t-Form-fieldContainer'), 'field sample');

// sections come from each setting's section; a setting whose dependency is false is not drawn
const depV = { id: 'dep', label: 'Dep', params: [
  { key: 'mode', label: 'Mode', kind: 'select', options: ['a', 'b'], default: 'a' },
  { key: 'gapB', label: 'Gap B', kind: 'px', default: '', section: 'advanced', dependsOn: { key: 'mode', equals: 'b' } }] };
assert.ok(/<label class="fl-param" data-for="gapB" hidden>/.test(P.html(depV, { mode: 'a' }, {})), 'dependency false: hidden');
assert.ok(P.html(depV, { mode: 'b' }, {}).includes('fl-adv-section'), 'dependency true: advanced section drawn');
assert.ok(/<label class="fl-param" data-for="gapB">/.test(P.html(depV, { mode: 'b' }, {})), 'dependency true: shown');
// ripple is drawn only for designs that have one
assert.ok(P.html(V.get('button', 'v1'), {}, {}).includes('data-param="ripple"'), 'button has ripple');
assert.ok(!P.html(V.get('text', 'v1'), {}, {}).includes('data-param="ripple"'), 'text has no ripple');

assert.ok(/<summary>States<\/summary>[\s\S]*data-param="disabledOpacity"/.test(P.html(V.get('text', 'v1'), {}, {})), 'States section');

// ---- gallery: built-in badges, preset slot, actions
{
  const g = P.gallery('text', { current: 'v2', canReset: true });
  assert.strictEqual((g.html.match(/class="fl-badge">Built-in</g) || []).length, V.forType('text').length, 'every design has a Built-in badge');
  assert.ok(/is-selected" role="button" tabindex="0" data-variant="v2"/.test(g.html), 'current design selected');
  assert.ok(g.html.includes('data-gallery="reset"'), 'Reset settings shown');
  assert.ok(!g.html.includes('data-gallery="save"'), 'no Save as preset until presets exist');
  assert.ok(/data-gallery="reset"[^>]* hidden>/.test(P.gallery('text', { current: 'v2' }).html), 'reset hidden without values');
  assert.ok(!/data-gallery="reset"[^>]* hidden>/.test(g.html), 'reset visible with values');
  const pg = P.gallery('text', { current: 'v1', preset: 0, canSave: true,
    presets: [{ label: 'Brand field', variant: 'v1', values: { radius: 12 } }] });
  assert.ok(pg.html.includes('data-preset="0"') && pg.html.includes('class="fl-badge fl-badge--custom">Custom<'), 'preset card with Custom badge');
  assert.ok(pg.html.includes('data-gallery="save"'), 'Save as preset when allowed');
  assert.ok(/is-selected" role="button" tabindex="0" data-preset="0"/.test(pg.html) && !/is-selected" role="button" tabindex="0" data-variant/.test(pg.html), 'the selected preset, not its design');
  assert.ok(pg.css.includes('#fl-preset-0'), 'preset thumbnail styled');
  assert.strictEqual(P.gallery('text', {}).html, P.gallery('text', {}).html, 'same gallery for both designers');
}
// ---- cards are not <button>s: the date, Popup LOV and button samples hold their own <button>
{
  ['date', 'button', 'text'].forEach((type) => {
    const g = P.gallery(type, { current: 'v1', preset: 0, presets: [{ label: 'P', variant: 'v1', values: {} }] }).html;
    assert.ok(!g.includes('<button class="fl-variant'), type + ': no button card');
    const cards = g.match(/<div class="fl-variant[ "][^>]*>/g) || [];
    assert.ok(cards.length >= 2, type + ': cards are divs');
    assert.ok(cards.every((c) => /role="button" tabindex="0"/.test(c) || /tabindex="0"[^>]*role="button"|role="button"[^>]*tabindex="0"/.test(c)), type + ': cards are focusable buttons by role');
    assert.strictEqual((g.match(/<span class="fl-thumb" inert>/g) || []).length, cards.length, type + ': every thumbnail is inert');
  });
  const dg = P.gallery('date', { current: 'v1' }).html;
  assert.ok(dg.includes('a-Button--calendar'), 'date sample keeps its real calendar button');
}
// ---- quick palette: the theme accent and the colours of its styles, once each
{
  const theme = { global: { accent: '#1A73E8', pageBg: '#fafafa' }, types: { text: { styles: [{ values: { accent: '#1a73e8', text: '#222222', radius: 8 } }] },
    button: { styles: [{ values: { bg: '#ff0000', customCss: 'color:#000' } }] } } };
  assert.strictEqual(JSON.stringify(P.themeColors(theme)), JSON.stringify(['#1a73e8', '#222222', '#ff0000']), 'accent first, then style colours, no duplicates');
  assert.strictEqual(P.themeColors(null).length, 0, 'no theme, no swatches');
  const pal = P.palette(['#1a73e8']);
  assert.ok(pal.includes('data-swatch="#1a73e8"'), 'swatch drawn');
  assert.strictEqual(P.palette([]), '', 'no palette without colours');
}

console.log('fl_params_test: all passed');
