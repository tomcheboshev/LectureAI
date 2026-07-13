// Hand-rolled CSV writer, matching this codebase's preference for small
// utilities (utils/httpError.js, utils/withTimeout.js) over pulling in a
// dependency for something this small.

function quote(value) {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// `rowSource` is either a plain array of objects, or anything async-iterable
// (e.g. a Mongoose `.cursor()`) — the latter keeps memory bounded regardless
// of collection size. `columns` is [{key, header}].
export async function sendCsv(res, filename, columns, rowSource) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  res.write(columns.map((c) => quote(c.header)).join(",") + "\r\n");
  for await (const row of rowSource) {
    res.write(columns.map((c) => quote(row[c.key])).join(",") + "\r\n");
  }
  res.end();
}
