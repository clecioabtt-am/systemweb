export async function onRequest(context){
  const url = new URL(context.request.url);
  if(url.pathname.startsWith('/api/')){
    context.requestId = crypto.randomUUID();
  }
  return context.next();
}
