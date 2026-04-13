export type SidebarTheme = "winter" | "dim";

export interface SidebarSessionUser {
  name?: string | null;
  role?: string | null;
  [key: string]: unknown;
}

export interface SidebarSession {
  user?: SidebarSessionUser | null;
  [key: string]: unknown;
}

export interface SidebarSessionState<
  TSession extends SidebarSession = SidebarSession,
> {
  data: TSession | null;
}

export type SidebarThemeUpdateResult =
  | {
      success: boolean;
      error?: string;
    }
  | boolean
  | void
  | null
  | undefined;

export interface SidebarAdapterProps<
  TSession extends SidebarSession = SidebarSession,
> {
  session?: TSession | null;
  sessionState?: SidebarSessionState<TSession> | null;
  onSignOut?: () => Promise<unknown> | unknown;
  updateDarkMode?: (
    newTheme: SidebarTheme,
  ) => Promise<SidebarThemeUpdateResult> | SidebarThemeUpdateResult;
}
