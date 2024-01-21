export function onRequest(context) {
  console.log("sandler request context", context);
  return new Response("Sandler is a fat dog.");
}
