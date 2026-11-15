/* APEX Visual Designer — component registry.
   A family is a group of APEX components that share the same markup, and so the same designs.
   Everything the designer knows about a family lives in its one definition:

     { id, label, plural, category, members, variants,           required
       match, params, defaultVariant, editor, surface, hides, themeMark, sample, requires }   optional

   members: [{ kind: 'item' | 'button' | 'region', apexType, label, sample }]. A member with no
   apexType is a catch-all for its kind. match(component) is for families the type alone cannot tell.
   variants: [{ id, label, css(selector, values), params, needsJs, js, font }]. A family with an
   editor of its own (charts) has no designs.
   To add a family, register it from a file of its own; to add a design to an existing family,
   call registerVariant. Neither needs a change in this file. */
(function () {
  window.VD = window.VD || {};

  var CATEGORIES = [['form', 'Form'], ['selection', 'Selection'], ['action', 'Actions'], ['display', 'Display'],
    ['region', 'Regions'], ['report', 'Reports']];
  var KINDS = ['item', 'button', 'region'];
  var SETTING_KINDS = ['color', 'px', 'number', 'weight', 'select', 'css', 'icon'];
  var SECTIONS = ['basic', 'icon', 'hide', 'state', 'advanced'];
  var STATES = ['normal', 'hover', 'focus', 'disabled', 'readonly', 'error'];
  var ID = /^[a-z][a-z0-9-]{0,30}$/;

  var list = [];

  function fail(what, why) { throw new Error('Component registry: ' + what + ': ' + why); }
  function text(v) { return typeof v === 'string' && v.trim() !== ''; }
  function has(arr, v) { return arr.indexOf(v) >= 0; }
  function find(id) { return list.filter(function (f) { return f.id === id; })[0] || null; }

  // A setting: { key, label, kind, default, options, min, max, section, state, dependsOn }.
  // A state setting is empty by default: empty means "as the design has it".
  // dependsOn is { key, equals } or { key, oneOf: [...] }, on another setting of the same list.
  function checkSettings(what, settings) {
    var keys = (settings || []).map(function (s) { return s && s.key; });
    (settings || []).forEach(function (s) {
      if (!s || !text(s.key) || !text(s.label)) fail(what, 'a setting needs a key and a label');
      var name = 'setting ' + s.key;
      if (!has(SETTING_KINDS, s.kind)) fail(what, name + ' has the unknown kind ' + s.kind);
      if (!('default' in s)) fail(what, name + ' needs a default (an empty string means "as the design has it")');
      if (s.kind === 'select' && !(s.options && s.options.length)) fail(what, name + ' needs options');
      if (s.min != null || s.max != null) {
        if (s.kind !== 'px' && s.kind !== 'number') fail(what, name + ': only px and number settings have bounds');
        if ((s.min != null && typeof s.min !== 'number') || (s.max != null && typeof s.max !== 'number')) fail(what, name + ': bounds must be numbers');
        if (s.min != null && s.max != null && s.min > s.max) fail(what, name + ': min is above max');
      }
      if (s.section != null && !has(SECTIONS, s.section)) fail(what, name + ' has the unknown section ' + s.section);
      if (s.state != null) {
        if (!has(STATES, s.state)) fail(what, name + ' has the unknown state ' + s.state);
        if (s.default !== '') fail(what, name + ': a state setting is empty by default');
      }
      if (s.dependsOn != null) {
        var d = s.dependsOn;
        if (!d || d.key === s.key || !has(keys, d.key)) fail(what, name + ' depends on a setting that is not in its list');
        if (!('equals' in d) && !Array.isArray(d.oneOf)) fail(what, name + ': dependsOn needs equals or oneOf');
      }
    });
  }

  function checkVariant(what, v) {
    if (!v || !text(v.id) || !text(v.label)) fail(what, 'a design needs an id and a label');
    if (typeof v.css !== 'function') fail(what, 'design ' + v.id + ' needs a css(selector, values) function');
    checkSettings(what + ', design ' + v.id, v.params);
  }

  function register(def) {
    var what = 'family ' + (def && def.id);
    if (!def || !ID.test(def.id || '')) fail(what, 'the id must start with a letter and use only a-z, 0-9 and -');
    if (find(def.id)) fail(what, 'a family with the id ' + def.id + ' is already registered');
    if (!text(def.label) || !text(def.plural)) fail(what, 'a label and a plural label are needed');
    if (!CATEGORIES.some(function (c) { return c[0] === def.category; })) fail(what, 'unknown category ' + def.category);
    if (!def.members || !def.members.length) fail(what, 'at least one member is needed');
    def.members.forEach(function (m) {
      if (!m || !has(KINDS, m.kind)) fail(what, 'a member kind must be item, button or region');
      if (!text(m.label)) fail(what, 'a member needs a label');
      if (m.sample != null && typeof m.sample !== 'string') fail(what, 'the sample of member ' + m.label + ' must be markup text');
    });
    if (def.surface && !has(KINDS, def.surface)) fail(what, 'the surface must be item, button or region');
    if (def.match && typeof def.match !== 'function') fail(what, 'match must be a function');
    if (!def.variants || (!def.variants.length && !text(def.editor))) fail(what, 'at least one design is needed');
    var seen = {};
    def.variants.forEach(function (v) {
      checkVariant(what, v);
      if (seen[v.id]) fail(what, 'the design id ' + v.id + ' is used twice');
      seen[v.id] = true;
    });
    checkSettings(what, def.params);
    if (def.defaultVariant && !seen[def.defaultVariant]) fail(what, 'the default design ' + def.defaultVariant + ' does not exist');

    var family = {};
    Object.keys(def).forEach(function (k) { family[k] = def[k]; });
    family.members = def.members.slice();
    family.params = (def.params || []).slice();
    family.surface = def.surface || def.members[0].kind;
    family.variants = def.variants.map(function (v) { v.builtIn = true; return v; });
    family.defaultVariant = def.defaultVariant || (def.variants[0] ? def.variants[0].id : null);
    list.push(family);
    return family;
  }

  function registerVariant(familyId, variant) {
    var family = find(familyId);
    if (!family) fail('design for ' + familyId, 'there is no family ' + familyId);
    var what = 'family ' + familyId;
    checkVariant(what, variant);
    if (family.variants.some(function (v) { return v.id === variant.id; })) fail(what, 'the design id ' + variant.id + ' is used twice');
    variant.builtIn = true;
    family.variants.push(variant);
    return variant;
  }

  function variantOf(familyId, variantId) {
    var family = find(familyId);
    return (family && family.variants.filter(function (v) { return v.id === variantId; })[0]) || null;
  }

  // The family of a page component { kind, type, component }, or null. A family that names the
  // component's type, or whose match says yes, wins over a catch-all member of the same kind.
  function familyOf(c) {
    if (!c) return null;
    var named = list.filter(function (f) {
      if (f.match) return !!f.match(c);
      return f.members.some(function (m) { return m.kind === c.kind && m.apexType && m.apexType === c.type; });
    })[0];
    if (named) return named;
    return list.filter(function (f) {
      return !f.match && f.members.some(function (m) { return m.kind === c.kind && !m.apexType; });
    })[0] || null;
  }

  function categories() {
    return CATEGORIES.map(function (c) {
      return { id: c[0], label: c[1], families: list.filter(function (f) { return f.category === c[0]; }) };
    }).filter(function (c) { return c.families.length; });
  }

  window.VD.componentRegistry = {
    register: register,
    registerVariant: registerVariant,
    families: function () { return list.slice(); },
    family: find,
    variant: variantOf,
    familyOf: familyOf,
    categories: categories
  };
})();
