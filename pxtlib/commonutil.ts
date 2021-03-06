namespace ts.pxtc {
    export let __dummy = 42;
}

import pxtc = ts.pxtc

namespace ts.pxtc.Util {

    export function assert(cond: boolean, msg = "Assertion failed") {
        if (!cond) {
            debugger
            throw new Error(msg)
        }
    }

    export function flatClone<T>(obj: T): T {
        if (obj == null) return null
        let r: any = {}
        Object.keys(obj).forEach((k) => { r[k] = (obj as any)[k] })
        return r;
    }

    export function clone<T>(v: T): T {
        if (v == null) return null
        return JSON.parse(JSON.stringify(v))
    }

    export function htmlEscape(_input: string) {
        if (!_input) return _input; // null, undefined, empty string test
        return _input.replace(/([^\w .!?\-$])/g, c => "&#" + c.charCodeAt(0) + ";");
    }

    export function jsStringQuote(s: string) {
        return s.replace(/[^\w .!?\-$]/g,
            (c) => {
                let h = c.charCodeAt(0).toString(16);
                return "\\u" + "0000".substr(0, 4 - h.length) + h;
            });
    }

    export function jsStringLiteral(s: string) {
        return "\"" + jsStringQuote(s) + "\"";
    }

    // Localization functions. Please port any modifications over to pxtsim/localization.ts
    let _localizeLang: string = "en";
    let _localizeStrings: pxt.Map<string> = {};
    let _translationsCache: pxt.Map<pxt.Map<string>> = {};
    export let localizeLive = false;

    export interface ITranslationDbEntry {
        id?: string;
        etag: string;
        strings: pxt.Map<string>;
        cached?: boolean; // cached in memory, no download needed
    }

    export interface ITranslationDb {
        getAsync(lang: string, filename: string, branch: string): Promise<ITranslationDbEntry>;
        setAsync(lang: string, filename: string, branch: string, etag: string, strings: pxt.Map<string>): Promise<void>;
    }

    class MemTranslationDb implements ITranslationDb {
        translations: pxt.Map<ITranslationDbEntry> = {};
        key(lang: string, filename: string, branch: string) {
            return `${lang}|${filename}|${branch || ""}`;
        }
        getAsync(lang: string, filename: string, branch: string): Promise<ITranslationDbEntry> {
            return Promise.resolve(this.translations[this.key(lang, filename, branch)]);
        }
        setAsync(lang: string, filename: string, branch: string, etag: string, strings: pxt.Map<string>): Promise<void> {
            this.translations[this.key(lang, filename, branch)] = {
                etag,
                strings,
                cached: true
            }
            return Promise.resolve();
        }
    }

    // wired up in the app to store translations in pouchdb. MAY BE UNDEFINED!
    export let translationDb: ITranslationDb = new MemTranslationDb();

    /**
     * Returns the current user language, prepended by "live-" if in live mode
     */
    export function localeInfo(): string {
        return `${localizeLive ? "live-" : ""}${userLanguage()}`;
    }
    /**
     * Returns current user language iSO-code. Default is `en`.
     */
    export function userLanguage(): string {
        return _localizeLang;
    }
    export function setUserLanguage(localizeLang: string) {
        _localizeLang = localizeLang;
    }

    export function isUserLanguageRtl(): boolean {
        // ar: Arabic
        // dv: Divehi
        // fa: Farsi
        // ha: Hausa
        // he: Hebrew
        // ks: Kashmiri
        // ku: Kurdish
        // ps: Pashto
        // ur: Urdu
        // yi: Yiddish
        return /^ar|dv|fa|ha|he|ks|ku|ps|ur|yi/i.test(_localizeLang);
    }

    export function _localize(s: string) {
        return _localizeStrings[s] || s;
    }

    export function getLocalizedStrings() {
        return _localizeStrings;
    }

    export function setLocalizedStrings(strs: pxt.Map<string>) {
        _localizeStrings = strs;
    }

    export function translationsCache() {
        return _translationsCache;
    }

    export function fmt_va(f: string, args: any[]): string {
        if (args.length == 0) return f;
        return f.replace(/\{([0-9]+)(\:[^\}]+)?\}/g, function (s: string, n: string, spec: string): string {
            let v = args[parseInt(n)];
            let r = "";
            let fmtMatch = /^:f(\d*)\.(\d+)/.exec(spec);
            if (fmtMatch) {
                let precision = parseInt(fmtMatch[2])
                let len = parseInt(fmtMatch[1]) || 0
                let fillChar = /^0/.test(fmtMatch[1]) ? "0" : " ";
                let num = (<number>v).toFixed(precision)
                if (len > 0 && precision > 0) len += precision + 1;
                if (len > 0) {
                    while (num.length < len) {
                        num = fillChar + num;
                    }
                }
                r = num;
            } else if (spec == ":x") {
                r = "0x" + v.toString(16);
            } else if (v === undefined) r = "(undef)";
            else if (v === null) r = "(null)";
            else if (v.toString) r = v.toString();
            else r = v + "";
            if (spec == ":a") {
                if (/^\s*[euioah]/.test(r.toLowerCase()))
                    r = "an " + r;
                else if (/^\s*[bcdfgjklmnpqrstvwxz]/.test(r.toLowerCase()))
                    r = "a " + r;
            } else if (spec == ":s") {
                if (v == 1) r = ""
                else r = "s"
            } else if (spec == ":q") {
                r = Util.htmlEscape(r);
            } else if (spec == ":jq") {
                r = Util.jsStringQuote(r);
            } else if (spec == ":uri") {
                r = encodeURIComponent(r).replace(/'/g, "%27").replace(/"/g, "%22");
            } else if (spec == ":url") {
                r = encodeURI(r).replace(/'/g, "%27").replace(/"/g, "%22");
            } else if (spec == ":%") {
                r = (v * 100).toFixed(1).toString() + '%';
            }
            return r;
        });
    }

    export function fmt(f: string, ...args: any[]) { return fmt_va(f, args); }

    const locStats: { [index: string]: number; } = {};
    export function dumpLocStats() {
        const r: { [index: string]: string; } = {};
        Object.keys(locStats).sort((a, b) => locStats[b] - locStats[a])
            .forEach(k => r[k] = k);
        console.log('prioritized list of strings:')
        console.log(JSON.stringify(r, null, 2));
    }

    let sForPlural = true;
    export function lf_va(format: string, args: any[]): string {
        locStats[format] = (locStats[format] || 0) + 1;
        let lfmt = Util._localize(format)

        if (!sForPlural && lfmt != format && /\d:s\}/.test(lfmt)) {
            lfmt = lfmt.replace(/\{\d+:s\}/g, "")
        }

        lfmt = lfmt.replace(/\{(id|loc):[^\}]+\}/g, '');

        return fmt_va(lfmt, args);
    }

    export function lf(format: string, ...args: any[]): string {
        return lf_va(format, args);
    }
    /**
     * Similar to lf but the string do not get extracted into the loc file.
     */
    export function rlf(format: string, ...args: any[]): string {
        return lf_va(format, args);
    }

    export function lookup<T>(m: pxt.Map<T>, key: string): T {
        if (m.hasOwnProperty(key))
            return m[key]
        return null
    }

    export function isoTime(time: number) {
        let d = new Date(time * 1000)
        return Util.fmt("{0}-{1:f02.0}-{2:f02.0} {3:f02.0}:{4:f02.0}:{5:f02.0}",
            d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds())
    }

    export function userError(msg: string): Error {
        let e = new Error(msg);
        (<any>e).isUserError = true;
        throw e
    }
}

const lf = ts.pxtc.Util.lf;