/* A family used only by tests: proves a new family needs no edit to the designer files. */
(function () {
  window.VD.componentRegistry.register({
    id: 'rating', label: 'Star rating', plural: 'Star ratings', category: 'selection', surface: 'item',
    members: [{ kind: 'item', apexType: 'NATIVE_STAR_RATING', label: 'Star Rating' }],
    sample: '<span class="a-StarRating">★★★</span>',
    themeMark: ':has(.a-StarRating)',
    themeSample: '<span class="a-StarRating{cls}">★★★</span>',
    variants: [{ id: 'v1', label: 'Gold', params: [], css: function (sel) { return sel + ' .a-StarRating { color: gold; }\n'; } }]
  });
})();
