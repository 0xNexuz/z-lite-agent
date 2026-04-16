import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(__dirname, '../data');

export async function initDb() {
    const files = ['wallets.json', 'policies.json', 'tasks.json'];
    for (const file of files) {
        const filePath = path.join(DATA_DIR, file);
        try {
            await fs.access(filePath);
        } catch {
            await fs.writeFile(filePath, JSON.stringify({}), 'utf-8');
        }
    }
}

export async function readData<T>(fileName: string): Promise<Record<string, T>> {
    const filePath = path.join(DATA_DIR, fileName);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
}

export async function writeData<T>(fileName: string, data: Record<string, T>): Promise<void> {
    const filePath = path.join(DATA_DIR, fileName);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function getUserWallet(telegramId: string): Promise<any | null> {
    const wallets = await readData<any>('wallets.json');
    return wallets[telegramId] || null;
}