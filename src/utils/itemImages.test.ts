import { describe, it, expect } from 'vitest';
import { emailPhotoUrl, imagesForSave, isAcceptedPhoto, isGif, isHeic, movePhoto, photoProblem, photosFromItem, removedPublicIds, storedImages, storedPhotoUrl } from './itemImages';

describe('which files are accepted', () => {
  it('takes JPG, PNG, WebP, GIF and HEIC/HEIF, by type or by name', () => {
    for (const f of [{ name: 'a.jpg', type: 'image/jpeg' }, { name: 'a.PNG', type: 'image/png' }, { name: 'a.webp', type: 'image/webp' }, { name: 'a.gif', type: 'image/gif' }, { name: 'IMG_1.HEIC', type: 'image/heic' }, { name: 'IMG_2.heif', type: 'image/heif' }]) {
      expect(isAcceptedPhoto(f)).toBe(true);
    }
    // Chrome on a Mac reports no type for a .heic file
    expect(isAcceptedPhoto({ name: 'IMG_3.heic', type: '' })).toBe(true);
    expect(isAcceptedPhoto({ name: 'x.jpeg', type: '' })).toBe(true);
  });

  it('refuses other files', () => {
    expect(isAcceptedPhoto({ name: 'a.pdf', type: 'application/pdf' })).toBe(false);
    expect(isAcceptedPhoto({ name: 'a.svg', type: 'image/svg+xml' })).toBe(false);
    expect(isAcceptedPhoto({ name: 'noext', type: '' })).toBe(false);
  });

  it('knows HEIC and GIF', () => {
    expect(isHeic({ name: 'a.HEIC', type: '' })).toBe(true);
    expect(isHeic({ name: 'a.jpg', type: 'image/jpeg' })).toBe(false);
    expect(isGif({ name: 'a.gif', type: '' })).toBe(true);
  });

  it('says why a file cannot be added', () => {
    expect(photoProblem({ name: 'a.jpg', type: 'image/jpeg', size: 1000 })).toBeNull();
    expect(photoProblem({ name: 'a.pdf', type: 'application/pdf', size: 1000 })).toMatch(/not a photo/);
    expect(photoProblem({ name: 'big.gif', type: 'image/gif', size: 11 * 1024 * 1024 })).toMatch(/10 MB/);
  });
});

describe('stored URL of an upload', () => {
  it('turns a HEIC/HEIF upload into a .jpg URL and leaves the rest alone', () => {
    expect(storedPhotoUrl('https://res.cloudinary.com/x/image/upload/v1/a/b.heic', 'heic')).toBe('https://res.cloudinary.com/x/image/upload/v1/a/b.jpg');
    expect(storedPhotoUrl('https://res.cloudinary.com/x/image/upload/v1/a/b.HEIF')).toBe('https://res.cloudinary.com/x/image/upload/v1/a/b.jpg');
    expect(storedPhotoUrl('https://res.cloudinary.com/x/image/upload/v1/a/b.gif', 'gif')).toBe('https://res.cloudinary.com/x/image/upload/v1/a/b.gif');
    expect(storedPhotoUrl('https://res.cloudinary.com/x/image/upload/v1/a/b.jpg', 'jpg')).toBe('https://res.cloudinary.com/x/image/upload/v1/a/b.jpg');
  });
});

describe('photos of an item', () => {
  it('uses the images list, or the single url of an older item', () => {
    expect(photosFromItem({ url: 'u1', public_id: 'p1' }).map((p) => [p.url, p.public_id])).toEqual([['u1', 'p1']]);
    const many = photosFromItem({ url: 'u1', public_id: 'p1', images: [{ url: 'u1', public_id: 'p1' }, { url: 'u2', public_id: 'p2' }] });
    expect(many.map((p) => p.url)).toEqual(['u1', 'u2']);
    expect(new Set(many.map((p) => p.key)).size).toBe(2);
    expect(photosFromItem(null)).toEqual([]);
    expect(photosFromItem({})).toEqual([]);
  });

  it('moves a photo and keeps the list otherwise', () => {
    expect(movePhoto(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(movePhoto(['a', 'b'], 0, 5)).toEqual(['a', 'b']);
  });

  it('builds the list to save, with new photos replaced by their upload', () => {
    const file = {} as File;
    const photos = [{ key: 'k1', url: 'blob:x', file }, { key: 'k2', url: 'u2', public_id: 'p2' }];
    const done = new Map([['k1', { url: 'u1', public_id: 'p1' }]]);
    expect(imagesForSave(photos, done)).toEqual([{ url: 'u1', public_id: 'p1' }, { url: 'u2', public_id: 'p2' }]);
    // an upload that did not return is left out rather than saving a blob address
    expect(imagesForSave(photos, new Map())).toEqual([{ url: 'u2', public_id: 'p2' }]);
  });

  it('lists the Cloudinary ids that went away', () => {
    expect(removedPublicIds([{ public_id: 'a' }, { public_id: 'b' }, { public_id: undefined }], [{ public_id: 'b' }])).toEqual(['a']);
    expect(removedPublicIds([{ public_id: 'a' }], [{ public_id: 'a' }])).toEqual([]);
  });

  it('reads the stored images of a legacy or a new item', () => {
    expect(storedImages({ url: 'u1', public_id: 'p1' })).toEqual([{ url: 'u1', public_id: 'p1' }]);
    expect(storedImages({ url: 'u1', public_id: 'p1', images: [{ url: 'u2', public_id: 'p2' }] })).toEqual([{ url: 'u1', public_id: 'p1' }, { url: 'u2', public_id: 'p2' }]);
    expect(storedImages({})).toEqual([]);
  });
});

describe('emailPhotoUrl', () => {
  const base = 'https://res.cloudinary.com/dpjcegnvb/image/upload/';
  it('makes a 640 px JPEG link from a stored photo', () => {
    expect(emailPhotoUrl(`${base}v1779341631/nikfoods/abc.webp`)).toBe(`${base}w_640,c_limit,q_auto,f_jpg/v1779341631/nikfoods/abc.webp`);
    expect(emailPhotoUrl(`${base}v12/x/y.png`)).toBe(`${base}w_640,c_limit,q_auto,f_jpg/v12/x/y.png`);
  });
  it('keeps animated GIFs as GIFs', () => {
    expect(emailPhotoUrl(`${base}v12/x/y.gif`)).toBe(`${base}w_640,c_limit,q_auto/v12/x/y.gif`);
  });
  it('leaves other links and links that already have a size alone', () => {
    expect(emailPhotoUrl('https://example.com/a.jpg')).toBe('https://example.com/a.jpg');
    expect(emailPhotoUrl(`${base}w_300,c_fill/v12/x/y.jpg`)).toBe(`${base}w_300,c_fill/v12/x/y.jpg`);
    expect(emailPhotoUrl('blob:https://nikfoodsadmin.vercel.app/abc')).toBe('blob:https://nikfoodsadmin.vercel.app/abc');
    expect(emailPhotoUrl('')).toBe('');
  });
});
