import * as exp from './expressions';
import { CharacterCodes } from './scanner';
import { AttrValueKind } from '../types';

export function getKindName(k: number | string): string {
    if (typeof k === 'string') {
        return k;
    }

    return (<any>exp).SyntaxKind[k];
}

export function getAttrValueKind(value: string): AttrValueKind {
    if (value.length >= 1) {
        switch (value.charCodeAt(0)) {
            case CharacterCodes.hash:
                if (value.charCodeAt(1) === CharacterCodes.hash) {
                    if (value.charCodeAt(2) === CharacterCodes.hash) {
                        return AttrValueKind.ConstantFactional;
                    }
                    return AttrValueKind.ConstantRacial;
                }
                return AttrValueKind.Constant;
            case CharacterCodes.at:
                if (value.charCodeAt(1) === CharacterCodes.at) {
                    if (value.charCodeAt(2) === CharacterCodes.at) {
                        return AttrValueKind.AssetFactional;
                    }
                    return AttrValueKind.AssetRacial;
                }
                return AttrValueKind.Asset;
            case CharacterCodes.openBrace:
                if (value.charCodeAt(value.length - 1) !== CharacterCodes.closeBrace) break;
                return AttrValueKind.PropertyBind;
            case CharacterCodes.asterisk:
                if (value.charCodeAt(1) !== CharacterCodes.at) break;
                return AttrValueKind.PtrAsset;
        }
    }
    return AttrValueKind.Generic;
}

export function isConstantValueKind(vKind: AttrValueKind) {
    switch (vKind) {
        case AttrValueKind.Constant:
        case AttrValueKind.ConstantRacial:
        case AttrValueKind.ConstantFactional:
            return true;
    }
    return false;
}

export function isConstantValue(value: string) {
    return isConstantValueKind(getAttrValueKind(value));
}

export function getSelectionFragmentAtPosition(pathSel: exp.PathSelector | exp.PropertyBindExpr, pos: number) {
    const idx = getSelectionIndexAtPosition(pathSel, pos);
    if (idx !== void 0) return pathSel.path[idx];
}

export function getSelectionIndexAtPosition(pathSel: exp.PathSelector | exp.PropertyBindExpr, pos: number) {
    for (const idx of pathSel.path.keys()) {
        const selFrag = pathSel.path[idx];
        if (selFrag.end < pos) continue;
        if (selFrag.pos > pos) continue;
        return idx;
    }
}

const reSlashDelimeterRe = /[\/\\]/;
export function splitSlashDelimetedStr(s: string) {
    return s.split(reSlashDelimeterRe);
}
