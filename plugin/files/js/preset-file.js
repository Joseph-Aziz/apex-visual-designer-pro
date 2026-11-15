/* APEX Visual Designer — preset files.
   A preset file carries an application's presets (its named theme styles) to another application:
   { format: 'vd-presets', version: 1, families: { <family id>: [ { name, cls, variant, values, isDefault } ] } }.
   Import checks every style and value, renames a class that is taken, and never overwrites. */
(function () {
  window.VD = window.VD || {};
  var VD = window.VD;
  var FORMAT = 'vd-presets', VERSION = 1;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // The presets of theme as a file object. Global theme settings are not presets and stay out.
  function toFile(theme) {
    var families = {};
    Object.keys((theme && theme.types) || {}).forEach(function (id) {
      var list = (theme.types[id].styles || []).map(function (s) {
        return { name: s.name, cls: s.cls, variant: s.variant, values: clone(s.values || {}), isDefault: !!s.isDefault };
      });
      if (list.length) families[id] = list;
    });
    return { format: FORMAT, version: VERSION, families: families };
  }

  // The first problem with one style of the file, or ''.
  function styleError(familyId, s) {
    var V = VD.flutterVariants;
    if (!s || typeof s !== 'object') return 'A preset of ' + familyId + ' is not an object.';
    var name = typeof s.name === 'string' ? s.name.trim() : '';
    if (!name || name.length > 40) return 'A preset of ' + familyId + ' needs a name of at most 40 characters.';
    if (!VD.themeCodegen.CLASS_NAME.test(s.cls || '')) return 'Preset ' + name + ': the class name must start with a letter and use only a-z, 0-9 and - (at most 31).';
    var variant = V.get(familyId, s.variant);
    if (!variant) return 'Preset ' + name + ' uses the unknown design ' + s.variant + ' of ' + familyId + '.';
    var values = s.values == null ? {} : s.values;
    if (typeof values !== 'object' || Array.isArray(values)) return 'Preset ' + name + ': values must be an object.';
    var bad = '';
    Object.keys(values).some(function (k) {
      var prm = variant.params.filter(function (p) { return p.key === k; })[0];
      if (!prm) { bad = 'Preset ' + name + ' has the unknown setting ' + k + '.'; return true; }
      var v = values[k];
      if (v === '' || v == null) return false;
      if ((typeof v !== 'string' && typeof v !== 'number') || V.cleanParam(prm, v) == null) {
        bad = 'Preset ' + name + ': the value of ' + k + ' is not allowed.'; return true;
      }
      return false;
    });
    return bad;
  }

  // A free class: cls, else cls-2, cls-3 ... within 31 characters.
  function freeClass(cls, used) {
    if (!used[cls]) return cls;
    for (var n = 2; ; n++) {
      var suffix = '-' + n, c = cls.slice(0, 31 - suffix.length) + suffix;
      if (!used[c]) return c;
    }
  }

  // Adds the file's presets to a copy of theme. -> { theme, added, renamed: [{ family, from, to }] } or { error }.
  // Nothing is added unless every style of the file is valid.
  function fromFile(theme, file) {
    if (!file || typeof file !== 'object') return { error: 'This is not a preset file.' };
    if (file.format !== FORMAT) return { error: 'This is not a preset file (format ' + file.format + ').' };
    if (file.version !== VERSION) return { error: 'This preset file has version ' + file.version + '; this designer reads version ' + VERSION + '.' };
    var fams = file.families;
    if (!fams || typeof fams !== 'object' || Array.isArray(fams)) return { error: 'The preset file has no families.' };
    var ids = Object.keys(fams), error = '';
    ids.some(function (id) {
      var f = VD.componentRegistry.family(id);
      if (!f || !f.variants.length) { error = 'The preset file has the unknown family ' + id + '.'; return true; }
      if (!Array.isArray(fams[id])) { error = 'The presets of ' + id + ' must be a list.'; return true; }
      return fams[id].some(function (s) { error = styleError(id, s); return !!error; });
    });
    if (error) return { error: error };

    var t = clone(theme || { global: {}, types: {} });
    t.types = t.types || {};
    var added = 0, renamed = [];
    ids.forEach(function (id) {
      t.types[id] = t.types[id] || { styles: [] };
      var list = t.types[id].styles, used = {};
      list.forEach(function (s) { used[s.cls] = true; });
      var hasDefault = list.some(function (s) { return s.isDefault; });
      fams[id].forEach(function (s) {
        var cls = freeClass(s.cls, used);
        if (cls !== s.cls) renamed.push({ family: id, from: s.cls, to: cls });
        used[cls] = true;
        var isDefault = !!s.isDefault && !hasDefault;
        if (isDefault) hasDefault = true;
        var values = {};
        Object.keys(s.values || {}).forEach(function (k) { if (s.values[k] !== '' && s.values[k] != null) values[k] = s.values[k]; });
        list.push({ name: s.name.trim(), cls: cls, variant: s.variant, values: values, isDefault: isDefault });
        added += 1;
      });
    });
    var msgs = VD.themeCodegen.validate(t);
    if (msgs.length) return { error: msgs[0] };
    return { theme: t, added: added, renamed: renamed };
  }

  VD.presetFile = { toFile: toFile, fromFile: fromFile, FORMAT: FORMAT, VERSION: VERSION };
})();
