/**
 * Супергруппы в Telegram имеют chat_id вида -100xxxxxxxxxx.
 * Если передан короткий вид -xxxxxxxxxx (без 100) — дополняем до -100...
 * @param {string|number|null} id — ID чата из .env или настроек
 * @returns {string|null}
 */
function normalizeSupergroupId(id) {
  if (id == null || id === "") return null;
  const s = String(id).trim();
  const m = s.match(/^-(\d+)$/);
  if (!m) return s;
  const num = m[1];
  if (num.startsWith("100")) return s;
  return `-100${num}`;
}

module.exports = { normalizeSupergroupId };
