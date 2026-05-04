export type GarageProxyUrlOptions = {
  bucket: string;
  key: string;
  fileName?: string | null;
  inline?: boolean;
  contentType?: string | null;
};

export function buildGarageProxyUrl({
  bucket,
  key,
  fileName,
  inline = true,
  contentType,
}: GarageProxyUrlOptions): string {
  const params = new URLSearchParams({
    bucket,
    key,
  });

  if (inline) {
    params.set("inline", "1");
  }

  if (fileName) {
    params.set("fileName", fileName);
  }

  if (contentType) {
    params.set("contentType", contentType);
  }

  return `/api/user/garage?${params.toString()}`;
}
