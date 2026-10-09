// Load one of this site's own files. The Node server passes context.assets (reads from disk);
// on Spacefast and other edge hosts there is none, so the file is fetched from the same origin.
export async function loadAsset(request, context, path) {
  if (context && context.assets) return context.assets(path);
  const res = await fetch(new URL(path, request.url));
  if (!res.ok) throw new Error("asset " + path + " returned " + res.status);
  return { body: await res.text(), etag: res.headers.get("etag"), link: res.headers.get("link") };
}

export async function loadJson(request, context, path) {
  return JSON.parse((await loadAsset(request, context, path)).body);
}
