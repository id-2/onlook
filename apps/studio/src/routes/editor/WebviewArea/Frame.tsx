import { useEditorEngine } from '@/components/Context';
import { Icons } from '@onlook/ui/icons';
import { Button } from '@onlook/ui/button';
import type { WebviewMessageBridge } from '@/lib/editor/messageBridge';
import type { SizePreset } from '@/lib/sizePresets';
import { cn } from '@onlook/ui/utils';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef, useState } from 'react';
import BrowserControls from './BrowserControl';
import GestureScreen from './GestureScreen';
import ResizeHandles from './ResizeHandles';
import { Links } from '@onlook/models/constants';
import { isOnlookInDoc } from '/common/helpers';
import type { FrameSettings } from '@onlook/models/projects';
import { toast } from '@onlook/ui/use-toast';
import { AnimatePresence, motion } from 'framer-motion';

const Frame = observer(
    ({
        messageBridge,
        settings,
    }: {
        messageBridge: WebviewMessageBridge;
        settings: FrameSettings & { folderPath: string };
    }) => {
        console.log('Frame rendering with settings:', settings);

        const RETRY_TIMEOUT = 3000;
        const DOM_FAILED_DELAY = 3000;
        const editorEngine = useEditorEngine();
        const webviewRef = useRef<Electron.WebviewTag | null>(null);

        const [selected, setSelected] = useState<boolean>(false);
        const [focused, setFocused] = useState<boolean>(false);
        const [hovered, setHovered] = useState<boolean>(false);
        const [darkmode, setDarkmode] = useState<boolean>(false);
        const [domReady, setDomReady] = useState(false);
        const [domFailed, setDomFailed] = useState(false);
        const [shouldShowDomFailed, setShouldShowDomFailed] = useState(false);
        const [onlookEnabled, setOnlookEnabled] = useState(false);
        const [selectedPreset, setSelectedPreset] = useState<SizePreset | null>(null);
        const [lockedPreset, setLockedPreset] = useState<SizePreset | null>(null);

        const [webviewSize, setWebviewSize] = useState(settings.dimension);
        const [webviewSrc, setWebviewSrc] = useState<string>(settings.url);

        const platformCommand = process.platform === 'win32' ? 'cd /d' : 'cd';
        const codeContent = `${platformCommand} ${settings.folderPath} && npm run dev`;

        const [isRunning, setIsRunning] = useState<boolean>(false); // State for animation

        const iconVariants = {
            initial: { scale: 0.5, opacity: 0 },
            animate: { scale: 1, opacity: 1 },
            exit: { scale: 0.5, opacity: 0 },
        };

        function copyToClipboard(text: string) {
            navigator.clipboard.writeText(text);
        }

        useEffect(setupFrame, [webviewRef]);
        useEffect(
            () => setSelected(editorEngine.webviews.isSelected(settings.id)),
            [editorEngine.webviews.webviews],
        );

        useEffect(() => {
            editorEngine.canvas.saveFrame(settings.id, {
                url: webviewSrc,
                dimension: webviewSize,
            });
        }, [webviewSize, webviewSrc]);

        useEffect(() => {
            let timer: Timer;

            if (domFailed) {
                timer = setTimeout(() => {
                    setShouldShowDomFailed(true);
                }, DOM_FAILED_DELAY);
            } else {
                setShouldShowDomFailed(false);
            }

            return () => {
                if (timer) {
                    clearTimeout(timer);
                }
            };
        }, [domFailed]);

        useEffect(() => {
            console.log('domReady:', domReady);
            console.log('domFailed:', domFailed);
            console.log('shouldShowDomFailed:', shouldShowDomFailed);
            console.log('webviewSize:', webviewSize);
        }, [domReady, domFailed, shouldShowDomFailed, webviewSize]);

        useEffect(() => {
            console.log('webviewRef changed:', webviewRef.current);
        }, [webviewRef.current]);

        useEffect(() => {
            console.log('settings changed:', settings);
        }, [settings]);

        function setupFrame() {
            const webview = webviewRef.current as Electron.WebviewTag | null;
            if (!webview) {
                return;
            }
            editorEngine.webviews.register(webview);
            messageBridge.register(webview, settings.id);
            setBrowserEventListeners(webview);

            return () => {
                editorEngine.webviews.deregister(webview);
                messageBridge.deregister(webview);
                webview.removeEventListener('did-navigate', handleUrlChange);
            };
        }

        function setBrowserEventListeners(webview: Electron.WebviewTag) {
            webview.addEventListener('did-navigate', handleUrlChange);
            webview.addEventListener('did-navigate-in-page', handleUrlChange);
            webview.addEventListener('dom-ready', handleDomReady);
            webview.addEventListener('did-fail-load', handleDomFailed);
            webview.addEventListener('focus', handleWebviewFocus);
            webview.addEventListener('blur', handleWebviewBlur);
        }

        function handleUrlChange(e: any) {
            setWebviewSrc(e.url);
        }

        async function handleDomReady() {
            const webview = webviewRef.current as Electron.WebviewTag | null;
            if (!webview) {
                return;
            }
            setDomReady(true);
            webview.setZoomLevel(0);
            const body = await editorEngine.dom.getBodyFromWebview(webview);
            setDomFailed(body.children.length === 0);
            checkForOnlookEnabled(body);
            setTimeout(() => getDarkMode(webview), 100);
        }

        async function getDarkMode(webview: Electron.WebviewTag) {
            const darkmode = (await webview.executeJavaScript(`window.api?.getTheme()`)) || 'light';
            setDarkmode(darkmode === 'dark');
        }

        function checkForOnlookEnabled(body: Element) {
            const doc = body.ownerDocument;
            setOnlookEnabled(isOnlookInDoc(doc));
        }

        function handleDomFailed() {
            setDomFailed(true);
            setTimeout(() => {
                const webview = webviewRef.current as Electron.WebviewTag | null;
                if (webview) {
                    webview.reload();
                }
            }, RETRY_TIMEOUT);
        }

        function handleWebviewFocus() {
            setFocused(true);
        }

        function handleWebviewBlur() {
            setFocused(false);
        }

        console.log('Frame about to render, webviewSize:', webviewSize);

        return (
            <div className="flex flex-col space-y-1.5">
                <BrowserControls
                    webviewRef={domReady ? webviewRef : null}
                    webviewSrc={webviewSrc}
                    setWebviewSrc={setWebviewSrc}
                    setWebviewSize={setWebviewSize}
                    selected={selected}
                    hovered={hovered}
                    setHovered={setHovered}
                    darkmode={darkmode}
                    setDarkmode={setDarkmode}
                    onlookEnabled={onlookEnabled}
                    selectedPreset={selectedPreset}
                    setSelectedPreset={setSelectedPreset}
                    lockedPreset={lockedPreset}
                    setLockedPreset={setLockedPreset}
                />
                <div className="relative">
                    <ResizeHandles
                        webviewRef={webviewRef}
                        webviewSize={webviewSize}
                        setWebviewSize={setWebviewSize}
                        selectedPreset={selectedPreset}
                        setSelectedPreset={setSelectedPreset}
                        lockedPreset={lockedPreset}
                        setLockedPreset={setLockedPreset}
                    />
                    <webview
                        id={settings.id}
                        ref={webviewRef}
                        className={cn(
                            'w-[96rem] h-[60rem] backdrop-blur-sm transition outline outline-4',
                            shouldShowDomFailed ? 'bg-transparent' : 'bg-white',
                            focused
                                ? 'outline-blue-400'
                                : selected
                                  ? 'outline-teal-400'
                                  : 'outline-transparent',
                        )}
                        src={settings.url}
                        preload={`file://${window.env.WEBVIEW_PRELOAD_PATH}`}
                        allowpopups={'true' as any}
                        style={{
                            width: webviewSize.width,
                            height: webviewSize.height,
                        }}
                    ></webview>
                    <GestureScreen webviewRef={webviewRef} setHovered={setHovered} />
                    {domFailed && shouldShowDomFailed && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-gray-800/40 via-gray-500/40 to-gray-400/40 border-gray-500 border-[0.5px] space-y-6 rounded-xl">
                            <p className="text-active text-title1 text-center">
                                {'Your React app is not running'}
                            </p>
                            <p className="text-foreground-onlook text-title3 text-center max-w-80">
                                {'Copy the command below into your terminal to run the app'}
                            </p>
                            <div className="border-[0.5px] bg-background-secondary rounded-xl p-3 flex flex-row gap-2 items-center relative max-w-[400px]">
                                <div className="flex-1 overflow-x-auto">
                                    <code className="text-regular whitespace-nowrap block w-fit select-all cursor-text [&::selection]:text-teal-500 [&::selection]:bg-teal-500/20">
                                        {codeContent}
                                    </code>
                                </div>
                                <div className="flex items-center relative">
                                    <div className="absolute right-full top-0 bottom-0 w-[100px] bg-gradient-to-r from-transparent to-background-secondary pointer-events-none" />
                                    <Button
                                        className="px-10 flex-initial w-fit z-10 bg-foreground-onlook/85 text-background-onlook hover:bg-teal-500 hover:border-teal-200 hover:text-teal-100 dark:text-teal-100 dark:bg-teal-900 dark:hover:bg-teal-700 border-[0.5px] dark:border-teal-800 dark:hover:border-teal-500"
                                        onClick={() => {
                                            copyToClipboard(codeContent);
                                            setIsRunning(true);
                                            toast({ title: 'Copied to clipboard' });
                                            setTimeout(() => setIsRunning(false), 2000);
                                        }}
                                        variant={'secondary'}
                                        size={'lg'}
                                    >
                                        <div className="flex items-center justify-center gap-2 w-6">
                                            <AnimatePresence mode="wait" initial={false}>
                                                <motion.span
                                                    key={isRunning ? 'checkmark' : 'copy'}
                                                    variants={iconVariants}
                                                    initial="initial"
                                                    animate="animate"
                                                    exit="exit"
                                                    transition={{ duration: 0.1 }}
                                                >
                                                    {isRunning ? (
                                                        <Icons.Check />
                                                    ) : (
                                                        <Icons.ClipboardCopy />
                                                    )}
                                                </motion.span>
                                            </AnimatePresence>
                                            <span className="w-[50px]">
                                                {isRunning ? 'Copied' : 'Copy'}
                                            </span>
                                        </div>
                                    </Button>
                                </div>
                            </div>
                            <Button
                                variant={'link'}
                                size={'lg'}
                                className="text-title2"
                                onClick={() => {
                                    window.open(Links.USAGE_DOCS, '_blank');
                                }}
                            >
                                Read the get started guide
                                <Icons.ExternalLink className="ml-2 w-6 h-6" />
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        );
    },
);

export default Frame;
