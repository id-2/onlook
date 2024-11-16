import { MainChannels } from '@onlook/models/constants';
import * as pty from 'node-pty';
import os from 'os';
import { mainWindow } from '..';

class TerminalManager {
    private static instance: TerminalManager;
    private processes: Map<string, pty.IPty>;

    private constructor() {
        this.processes = new Map();
    }

    static getInstance(): TerminalManager {
        if (!TerminalManager.instance) {
            TerminalManager.instance = new TerminalManager();
        }
        return TerminalManager.instance;
    }

    createTerminal(id: string, options?: { cwd?: string }): boolean {
        try {
            const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

            const ptyProcess = pty.spawn(shell, [], {
                name: 'xterm-color',
                cols: 80,
                rows: 24,
                cwd: options?.cwd ?? process.env.HOME,
                env: process.env,
            });

            ptyProcess.onData((data: string) => {
                mainWindow?.webContents.send(MainChannels.TERMINAL_DATA_STREAM, {
                    id,
                    data,
                });
            });

            this.processes.set(id, ptyProcess);
            return true;
        } catch (error) {
            console.error('Failed to create terminal.', error);
            return false;
        }
    }

    write(id: string, data: string): boolean {
        try {
            this.processes.get(id)?.write(data);
            return true;
        } catch (error) {
            console.error('Failed to write to terminal.', error);
            return false;
        }
    }

    resize(id: string, cols: number, rows: number): boolean {
        try {
            this.processes.get(id)?.resize(cols, rows);
            return true;
        } catch (error) {
            console.error('Failed to resize terminal.', error);
            return false;
        }
    }

    kill(id: string): boolean {
        try {
            const process = this.processes.get(id);
            if (process) {
                process.kill();
                this.processes.delete(id);
            }
            return true;
        } catch (error) {
            console.error('Failed to kill terminal.', error);
            return false;
        }
    }

    killAll(): boolean {
        this.processes.forEach((process) => process.kill());
        this.processes.clear();
        return true;
    }

    executeCommand(id: string, command: string): boolean {
        try {
            const newline = os.platform() === 'win32' ? '\r\n' : '\n';
            return this.write(id, command + newline);
        } catch (error) {
            console.error('Failed to execute command.', error);
            return false;
        }
    }
}

export default TerminalManager.getInstance();
