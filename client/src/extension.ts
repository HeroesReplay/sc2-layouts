import * as vs from 'vscode';
import * as lspc from 'vscode-languageclient';
import * as path from 'path';

type ProgressReportParams = {
    message?: string;
    increment?: number;
};

interface ProgressProxy {
    done: () => void;
    progress: vs.Progress<ProgressReportParams>;
}

function createProgressNotification(params: ProgressReportParams) {
    let r = <ProgressProxy>{};
    vs.window.withProgress(
        {
            title: params.message,
            location: vs.ProgressLocation.Notification,
        },
        (progress, token) => {
            r.progress = progress;

            return new Promise((resolve) => {
                r.done = resolve;
            });
        }
    );
    return r;
}

const sc2layoutConfig: vs.LanguageConfiguration = {
    indentationRules: {
        increaseIndentPattern: /<(?!\?|[^>]*\/>)([-_\.A-Za-z0-9]+)(?=\s|>)\b[^>]*>(?!.*<\/\1>)|<!--(?!.*-->)|\{[^}"']*$/,
        decreaseIndentPattern: /^\s*(<\/[-_\.A-Za-z0-9]+\b[^>]*>|-->|\})/,

        /**
         * following rule would handle indentation correctly in scenarios like such, but do we really want that?
         *
         * ```xml
         * <Frame type="Frame" name="GameUI/WorldPanel" file="GameUI">
         * <Visible val="False"/></Frame>
         * ```
         */
        // decreaseIndentPattern: /^(\s*<([-_\.A-Za-z0-9]+)([-_\.A-Za-z0-9]+)(?=\s|>)\b[^\/>]*\/>)*\s*(<\/[-_\.A-Za-z0-9]+\b[^>]*>|-->|\})/,
    },
    wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
    onEnterRules: [
        {
            beforeText: /<([_:\w][_:\w-.\d]*)([^>/]*(?!\/>)(\/[^>]|>))+[^</]*$/i,
            afterText: /^<\/([_:\w][_:\w-.\d]*)\s*>\s*$/i,
            action: { indentAction: vs.IndentAction.IndentOutdent }
        },
    ],
};

let client: lspc.LanguageClient;
let extContext: vs.ExtensionContext;

export async function activate(context: vs.ExtensionContext) {
    extContext = context;
    context.subscriptions.push(vs.languages.setLanguageConfiguration('sc2layout', sc2layoutConfig));

    const serverModule = context.asAbsolutePath(path.join('backend', 'out', 'src', 'bin', 's2l-lsp.js'));

    const envSvc = Object.assign({}, process.env);
    envSvc.SC2LAYOUT_LOG_LEVEL = vs.workspace.getConfiguration('sc2layout.trace').get('service');

    const serverOptions: lspc.ServerOptions = {
        run: { module: serverModule, transport: lspc.TransportKind.ipc, options: {
            env: envSvc,
        }},
        debug: { module: serverModule, transport: lspc.TransportKind.ipc, options: {
            execArgv: ['--nolazy', '--inspect=6009'],
            env: Object.assign(envSvc, { SC2LDEBUG: 1 }),
        }}
    };

    const clientOptions: lspc.LanguageClientOptions = {
        documentSelector: [{scheme: 'file', language: 'sc2layout'}],
        synchronize: {
            configurationSection: 'sc2layout',
            fileEvents: [
                vs.workspace.createFileSystemWatcher(
                    '**/{GameStrings.txt,GameHotkeys.txt,Assets.txt,AssetsProduct.txt,FontStyles.SC2Style,*.SC2Layout}'
                ),
            ],
        },
        initializationOptions: {
            defaultDataPath: context.asAbsolutePath('sc2-data'),
            globalStoragePath: context.globalStoragePath,
            wordPattern: [sc2layoutConfig.wordPattern.source, sc2layoutConfig.wordPattern.flags],
        },
    };

    client = new lspc.LanguageClient('sc2layout', 'SC2Layout', serverOptions, clientOptions);
    client.start();
    await client.onReady();

    let indexingProgress: ProgressProxy;
    client.onNotification('progressCreate', (params: ProgressReportParams) => {
        if (indexingProgress) indexingProgress.done();
        indexingProgress = createProgressNotification(params);
    });
    client.onNotification('progressReport', (params: ProgressReportParams) => {
        if (!indexingProgress) return;
        indexingProgress.progress.report(params);
    });
    client.onNotification('progressDone', (params: ProgressReportParams) => {
        if (indexingProgress) indexingProgress.done();
        indexingProgress = void 0;
        vs.window.setStatusBarMessage(params.message, 2000);
    });
}

export async function deactivate() {
    if (!client) {
        await client.stop();
        client = void 0;
    }
    extContext = void 0;
}

export function getThemeIcon(name: string) {
    return {
        light: path.join(extContext.extensionPath, 'resources', 'light', `${name}`),
        dark: path.join(extContext.extensionPath, 'resources', 'dark', `${name}`)
    };
}
