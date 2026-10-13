import { findByProps, findByStoreName } from "@vendetta/metro";

const ThemeStore = findByStoreName("ThemeStore");
const colorModule = findByProps("colors", "unsafe_rawColors");
const colorResolver = colorModule?.internal ?? colorModule?.meta;

export const TextStyleSheet = findByProps("TextStyleSheet")
	?.TextStyleSheet as _TextStyleSheet | undefined;

export function resolveSemanticColor(color: any, theme: string = ThemeStore?.theme) {
	return (color && colorResolver?.resolveSemanticColor(theme, color)) || "#000000";
}

export type TextStyleSheetCase = "normal" | "medium" | "semibold" | "bold";

type TextStyleSheetHasExtraBoldCase =
	| "heading-sm"
	| "heading-md"
	| "heading-lg"
	| "heading-xl"
	| "heading-xxl"
	| "heading-deprecated-12";
type TextStyleSheetHasCase =
	| TextStyleSheetHasExtraBoldCase
	| "text-xxs"
	| "text-xs"
	| "text-sm"
	| "text-md"
	| "text-lg";

export type TextStyleSheetVariant =
	| `${TextStyleSheetHasCase}/${TextStyleSheetCase}`
	| `${TextStyleSheetHasExtraBoldCase}/${TextStyleSheetCase | "extrabold"}`
	| "eyebrow"
	| "display-sm"
	| "display-md"
	| "display-lg";

type _TextStyleSheet = Record<TextStyleSheetVariant, object>;
