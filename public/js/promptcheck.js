// Shared by the browser (live checklist) and the server (authoritative check before a generation is allowed).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.PromptCheck = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // lenient only on case, spacing and curly quotes; the wording itself must match exactly
  const norm = t => String(t || '').toLowerCase().replace(/[\u2018\u2019\u201B]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\s+/g, ' ').trim();
  const COLORS = ['red','orange','yellow','green','blue','navy','teal','cyan','purple','violet','pink','magenta','brown','beige','cream','black','white','grey','gray','gold','silver','maroon','indigo','coral','peach','mint','lavender','turquoise','crimson','olive','amber','charcoal','ivory','tan','burgundy','emerald','lime','sky blue','rose','lilac','mustard','terracotta','slate'];
  const COLOR_WORD = /\b(colou?rs?|colou?r scheme|palette|theme)\b/;
  const NAMED = new RegExp('\\b(' + COLORS.join('|') + ')\\b');
  const CODE = /#[0-9a-f]{3,8}\b|\brgba?\s*\(|\bhsla?\s*\(/;

  function check(prompt, rules) {
    rules = rules || {};
    const p = norm(prompt), items = [], missing = [];
    const add = (key, label, ok, detail) => { items.push({ key, label, ok }); if (!ok) missing.push(detail || label); };
    if (rules.reward && p.includes(norm(rules.reward))) {
      return { ok: true, items: [{ key: 'reward', label: 'Solved quiz prompt', ok: true }], missing: [] };
    }
    if (rules.problem) add('problem', 'Problem statement typed exactly', p.includes(norm(rules.problem)),
      'The problem statement typed exactly as shown: "' + rules.problem + '"');
    if (rules.enhancement) add('enhancement', 'Round enhancement typed exactly', p.includes(norm(rules.enhancement)),
      'The round enhancement typed exactly as shown: "' + rules.enhancement + '"');
    if (rules.features && rules.features.length) {
      const lost = rules.features.filter(f => !p.includes(norm(f)));
      add('features', `Required features (${rules.features.length - lost.length}/${rules.features.length})`, !lost.length,
        'These required features written out: ' + lost.join('; '));
    }
    add('color', 'Colour scheme explained', COLOR_WORD.test(p) && (NAMED.test(p) || CODE.test(p)),
      'An explanation of the colour scheme (say "colour"/"palette" and name the actual colours, e.g. cream background, #8b4513 accents)');
    return { ok: !missing.length, items, missing };
  }
  function message(missing) {
    return 'PROMPT RULE VIOLATION\n\nYour prompt must include:\n' + missing.map(m => '• ' + m).join('\n') + '\n\nNo attempt was used.';
  }
  return { check, message, norm };
});
