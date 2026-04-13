"use client";

import React from "react";

export type AdaptiveLinkProps = React.PropsWithChildren<
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    href: string;
    prefetch?: boolean;
    replace?: boolean;
    scroll?: boolean;
  }
>;

type LinkComponent = React.ComponentType<AdaptiveLinkProps>;

const readHashPathname = (): string => {
  if (typeof window === "undefined") {
    return "";
  }

  const hash = window.location.hash;
  if (!hash.startsWith("#/")) {
    return "";
  }

  const [pathOnly] = hash.slice(1).split(/[?#]/);
  return pathOnly || "";
};

const isHashRouterContext = (): boolean => readHashPathname().length > 0;

const resolveFallbackHref = (href: string): string => {
  if (typeof window === "undefined") {
    return href;
  }

  if (!isHashRouterContext()) {
    return href;
  }

  if (!href.startsWith("/")) {
    return href;
  }

  return `#${href}`;
};

const normalizeInternalHref = (href: string): string => {
  if (!href) {
    return "/";
  }

  return href.startsWith("/") ? href : `/${href}`;
};

const FallbackLink: LinkComponent = ({
  href,
  children,
  prefetch: _prefetch,
  replace: _replace,
  scroll: _scroll,
  ...anchorProps
}) => (
  <a href={resolveFallbackHref(href)} {...anchorProps}>
    {children}
  </a>
);

let nextLinkPromise: Promise<LinkComponent | null> | null = null;

const loadNextLink = async (): Promise<LinkComponent | null> => {
  if (nextLinkPromise) {
    return nextLinkPromise;
  }

  nextLinkPromise = (async () => {
    try {
      const moduleName = "next/link";
      const mod = (await import(/* @vite-ignore */ moduleName)) as {
        default?: LinkComponent;
      };
      return mod.default ?? null;
    } catch {
      return null;
    }
  })();

  return nextLinkPromise;
};

export const useAdaptiveLink = (): LinkComponent => {
  const [LinkImpl, setLinkImpl] = React.useState<LinkComponent>(
    () => FallbackLink,
  );

  React.useEffect(() => {
    let mounted = true;

    void loadNextLink().then((component) => {
      if (mounted && component) {
        setLinkImpl(() => component);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  return LinkImpl;
};

export const AdaptiveLink = ({ children, ...props }: AdaptiveLinkProps) => {
  const LinkImpl = useAdaptiveLink();
  return <LinkImpl {...props}>{children}</LinkImpl>;
};

export type AdaptiveImageProps = Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  "src" | "alt" | "width" | "height"
> & {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  priority?: boolean;
};

type ImageComponent = React.ComponentType<AdaptiveImageProps>;

const FallbackImage: ImageComponent = ({
  src,
  alt,
  width,
  height,
  fill,
  priority,
  loading,
  style,
  ...imgProps
}) => {
  const computedStyle: React.CSSProperties | undefined = fill
    ? {
        ...style,
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
      }
    : style;

  return (
    <img
      src={src}
      alt={alt}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      loading={loading ?? (priority ? "eager" : "lazy")}
      style={computedStyle}
      {...imgProps}
    />
  );
};

let nextImagePromise: Promise<ImageComponent | null> | null = null;

const loadNextImage = async (): Promise<ImageComponent | null> => {
  if (nextImagePromise) {
    return nextImagePromise;
  }

  nextImagePromise = (async () => {
    try {
      const moduleName = "next/image";
      const mod = (await import(/* @vite-ignore */ moduleName)) as {
        default?: ImageComponent;
      };
      return mod.default ?? null;
    } catch {
      return null;
    }
  })();

  return nextImagePromise;
};

export const useAdaptiveImage = (): ImageComponent => {
  const [ImageImpl, setImageImpl] = React.useState<ImageComponent>(
    () => FallbackImage,
  );

  React.useEffect(() => {
    let mounted = true;

    void loadNextImage().then((component) => {
      if (mounted && component) {
        setImageImpl(() => component);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  return ImageImpl;
};

export const AdaptiveImage = (props: AdaptiveImageProps) => {
  const ImageImpl = useAdaptiveImage();
  return <ImageImpl {...props} />;
};

const NAVIGATION_EVENT = "rtc:adaptive-navigation-change";

type PatchedHistory = History & {
  __rtcAdaptivePatched?: boolean;
};

const runDeferred = (callback: () => void) => {
  if (typeof queueMicrotask === "function") {
    queueMicrotask(callback);
    return;
  }

  Promise.resolve().then(callback);
};

const notifyNavigationChange = () => {
  if (typeof window === "undefined") {
    return;
  }
  runDeferred(() => {
    window.dispatchEvent(new Event(NAVIGATION_EVENT));
  });
};

const ensureHistoryPatched = () => {
  if (typeof window === "undefined") {
    return;
  }

  const historyRef = window.history as PatchedHistory;
  if (historyRef.__rtcAdaptivePatched) {
    return;
  }

  historyRef.__rtcAdaptivePatched = true;

  const pushState = historyRef.pushState.bind(historyRef);
  const replaceState = historyRef.replaceState.bind(historyRef);

  historyRef.pushState = ((...args: Parameters<History["pushState"]>) => {
    pushState(...args);
    notifyNavigationChange();
  }) as History["pushState"];

  historyRef.replaceState = ((...args: Parameters<History["replaceState"]>) => {
    replaceState(...args);
    notifyNavigationChange();
  }) as History["replaceState"];
};

const readPathname = () => {
  if (typeof window === "undefined") {
    return "";
  }

  const hashPath = readHashPathname();
  if (hashPath) {
    return hashPath;
  }

  return window.location.pathname;
};

export const useAdaptivePathname = (): string => {
  // Keep initial render deterministic between server and client to avoid hydration mismatches.
  const [pathname, setPathname] = React.useState<string>("");
  const pathnameRef = React.useRef("");

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    ensureHistoryPatched();

    const update = () => {
      const nextPathname = readPathname();
      if (nextPathname === pathnameRef.current) {
        return;
      }

      runDeferred(() => {
        if (nextPathname === pathnameRef.current) {
          return;
        }
        pathnameRef.current = nextPathname;
        setPathname(nextPathname);
      });
    };

    update();
    window.addEventListener("popstate", update);
    window.addEventListener("hashchange", update);
    window.addEventListener(NAVIGATION_EVENT, update);

    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener("hashchange", update);
      window.removeEventListener(NAVIGATION_EVENT, update);
    };
  }, []);

  return pathname;
};

export const useAdaptivePathName = useAdaptivePathname;

export interface AdaptiveNavigation {
  push: (href: string) => void;
  replace: (href: string) => void;
  back: () => void;
  forward: () => void;
  refresh: () => void;
  prefetch: (href: string) => Promise<void>;
}

export const useAdaptiveNavigation = (): AdaptiveNavigation => {
  return React.useMemo(
    () => ({
      push: (href: string) => {
        if (typeof window === "undefined") {
          return;
        }

        if (isHashRouterContext()) {
          window.location.hash = normalizeInternalHref(href);
          return;
        }

        window.location.assign(href);
      },
      replace: (href: string) => {
        if (typeof window === "undefined") {
          return;
        }

        if (isHashRouterContext()) {
          const normalizedHref = normalizeInternalHref(href);
          window.location.replace(
            `${window.location.pathname}${window.location.search}#${normalizedHref}`,
          );
          return;
        }

        window.location.replace(href);
      },
      back: () => {
        if (typeof window === "undefined") {
          return;
        }
        window.history.back();
      },
      forward: () => {
        if (typeof window === "undefined") {
          return;
        }
        window.history.forward();
      },
      refresh: () => {
        if (typeof window === "undefined") {
          return;
        }
        window.location.reload();
      },
      prefetch: async (_href: string) => {
        // No-op outside Next router context.
      },
    }),
    [],
  );
};

export const useAdaptiveRouter = useAdaptiveNavigation;
