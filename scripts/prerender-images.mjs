// Keep original image URLs in baked HTML without downloading remote image bodies.
// A valid image avoids onError fallbacks that would hide or replace those URLs.
const placeholder = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1sAAAAASUVORK5CYII=',
  'base64',
);

export async function configurePrerenderImages(context, localOrigin) {
  await context.route('**/*', async (route) => {
    const request = route.request();
    if (request.resourceType() === 'image' && new URL(request.url()).origin !== localOrigin) {
      await route.fulfill({ status: 200, contentType: 'image/png', body: placeholder });
    } else {
      await route.continue();
    }
  });
}
