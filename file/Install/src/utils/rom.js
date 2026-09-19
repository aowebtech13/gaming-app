import path from 'path';
import fs from 'fs';
import unzipper from 'unzipper';
import { Readable } from 'stream';
import { consoleLog } from './logger.js';

/**
 * ROM utility functions for handling ROM file detection and processing
 */

/**
 * Detects ROM system from file extension or ZIP contents
 * @param {string} filename - The filename to analyze
 * @param {string|Buffer} filePathOrBuffer - Path to file or Buffer containing file data
 * @returns {Promise<string>} - The detected ROM system
 */
const detectRomSystem = async (filename, filePathOrBuffer = null) => {
    const ext = path.extname(filename).toLowerCase();
    
    // Extension to ROM system mapping
    const romExtensionMap = {
        '.nes': 'nes',
        '.snes': 'snes',
        '.sfc': 'snes',
        '.smc': 'snes',
        '.gba': 'gba',
        '.gb': 'gb',
        '.gbc': 'gb',
        '.md': 'genesis',
        '.gen': 'genesis',
        '.smd': 'genesis',
        '.32x': 'sega32x',
        '.gg': 'segaGG',
        '.sms': 'segaMS',
        '.n64': 'n64',
        '.z64': 'n64',
        '.v64': 'n64',
        '.bin': 'psx',
        '.cue': 'psx',
        '.iso': 'psx',
        '.pce': 'pce',
        '.nds': 'nds',
        '.vb': 'vb',
        '.a52': 'a5200',
        '.lnx': 'lynx',
        '.j64': 'jaguar',
        '.3do': '3do',
        '.d64': 'c64',
        '.adf': 'amiga',
        '.col': 'coleco',
        '.ngp': 'ngp',
        '.ws': 'ws',
        '.wsc': 'ws',
        '.pbp': 'psp',
        '.cso': 'psp'
    };
    
    // If it's a ZIP file and we have file data, check contents
    if (ext === '.zip' && filePathOrBuffer) {
        try {
            let detectedSystem;
            if (Buffer.isBuffer(filePathOrBuffer)) {
                detectedSystem = await detectRomSystemFromZipBuffer(filePathOrBuffer);
            } else if (fs.existsSync(filePathOrBuffer)) {
                detectedSystem = await detectRomSystemFromZip(filePathOrBuffer);
            } else {
                return 'arcade';
            }
            
            if (detectedSystem !== 'unknown') {
                return detectedSystem;
            }
        } catch (error) {
            consoleLog('error', 'Error detecting ROM system from ZIP', { error });
        }
        // Fall back to arcade if ZIP detection fails
        return 'arcade';
    }
    
    // For non-ZIP files or when ZIP detection isn't possible
    return romExtensionMap[ext] || 'unknown';
};

/**
 * Analyzes ZIP file contents to determine ROM system
 * @param {string} zipPath - Path to the ZIP file
 * @returns {Promise<string>} - The detected ROM system
 */
const detectRomSystemFromZip = async (zipPath) => {
    return new Promise((resolve, reject) => {
        const fileExtensions = [];
        
        fs.createReadStream(zipPath)
            .pipe(unzipper.Parse())
            .on('entry', (entry) => {
                const fileName = entry.path;
                const ext = path.extname(fileName).toLowerCase();
                
                // Skip directories and common non-ROM files
                if (entry.type === 'File' && ext && !isIgnoredFile(fileName)) {
                    fileExtensions.push(ext);
                }
                entry.autodrain();
            })
            .on('close', () => {
                const detectedSystem = analyzeFileExtensions(fileExtensions);
                resolve(detectedSystem);
            })
            .on('error', (error) => {
                reject(error);
            });
    });
};

/**
 * Analyzes ZIP buffer contents to determine ROM system
 * @param {Buffer} zipBuffer - Buffer containing ZIP file data
 * @returns {Promise<string>} - The detected ROM system
 */
const detectRomSystemFromZipBuffer = async (zipBuffer) => {
    return new Promise((resolve, reject) => {
        const fileExtensions = [];
        
        // Create a readable stream from the buffer
        const stream = new Readable();
        stream.push(zipBuffer);
        stream.push(null); // End the stream
        
        stream
            .pipe(unzipper.Parse())
            .on('entry', (entry) => {
                const fileName = entry.path;
                const ext = path.extname(fileName).toLowerCase();
                
                // Skip directories and common non-ROM files
                if (entry.type === 'File' && ext && !isIgnoredFile(fileName)) {
                    fileExtensions.push(ext);
                }
                entry.autodrain();
            })
            .on('close', () => {
                const detectedSystem = analyzeFileExtensions(fileExtensions);
                resolve(detectedSystem);
            })
            .on('error', (error) => {
                reject(error);
            });
    });
};

/**
 * Analyzes collected file extensions to determine ROM system
 * @param {string[]} extensions - Array of file extensions found in ZIP
 * @returns {string} - The detected ROM system
 */
const analyzeFileExtensions = (extensions) => {
    // ROM extension priority mapping
    const romSystemDetection = {
        '.pce': 'pce',          // PC Engine
        '.nes': 'nes',          // Nintendo Entertainment System
        '.snes': 'snes',        // Super Nintendo
        '.sfc': 'snes',         // Super Famicom
        '.smc': 'snes',         // Super Nintendo (SMC format)
        '.gba': 'gba',          // Game Boy Advance
        '.gb': 'gb',            // Game Boy
        '.gbc': 'gb',           // Game Boy Color
        '.md': 'genesis',       // Mega Drive
        '.gen': 'genesis',      // Genesis
        '.smd': 'genesis',      // Sega Mega Drive
        '.32x': 'sega32x',      // Sega 32X
        '.gg': 'segaGG',        // Game Gear
        '.sms': 'segaMS',       // Master System
        '.n64': 'n64',          // Nintendo 64
        '.z64': 'n64',          // Nintendo 64
        '.v64': 'n64',          // Nintendo 64
        '.bin': 'psx',          // PlayStation
        '.cue': 'psx',          // PlayStation
        '.iso': 'psx',          // PlayStation
        '.nds': 'nds',          // Nintendo DS
        '.vb': 'vb',            // Virtual Boy
        '.a52': 'a5200',        // Atari 5200
        '.lnx': 'lynx',         // Atari Lynx
        '.j64': 'jaguar',       // Atari Jaguar
        '.3do': '3do',          // 3DO
        '.d64': 'c64',          // Commodore 64
        '.adf': 'amiga',        // Amiga
        '.col': 'coleco',       // ColecoVision
        '.ngp': 'ngp',          // Neo Geo Pocket
        '.ws': 'ws',            // WonderSwan
        '.wsc': 'ws',           // WonderSwan Color
        '.pbp': 'psp',          // PlayStation Portable
        '.cso': 'psp'           // PlayStation Portable
    };
    
    // Check for specific ROM file extensions (highest priority)
    for (const ext of extensions) {
        if (romSystemDetection[ext]) {
            return romSystemDetection[ext];
        }
    }
    
    // If no specific ROM extensions found, default to arcade
    return 'arcade';
};

/**
 * Checks if a file should be ignored during ROM detection
 * @param {string} fileName - The filename to check
 * @returns {boolean} - True if file should be ignored
 */
const isIgnoredFile = (fileName) => {
    const ignoredExtensions = ['.txt', '.nfo', '.diz', '.jpg', '.png', '.gif', '.bmp'];
    const ignoredFiles = ['readme', 'license', 'info', 'description'];
    
    const ext = path.extname(fileName).toLowerCase();
    const baseName = path.basename(fileName, ext).toLowerCase();
    
    return ignoredExtensions.includes(ext) || ignoredFiles.includes(baseName);
};

/**
 * Maps ROM system to EmulatorJS core
 * @param {string} romSystem - The ROM system identifier
 * @returns {string} - The corresponding EmulatorJS core
 */
const mapRomSystemToCore = (romSystem) => {
    const coreMapping = {
        'nes': 'fceumm',           // Nintendo Entertainment System
        'snes': 'snes9x',          // Super Nintendo
        'gba': 'mgba',             // Game Boy Advance
        'gb': 'gambatte',          // Game Boy / Game Boy Color
        'genesis': 'genesis_plus_gx', // Sega Genesis/Mega Drive
        'n64': 'mupen64plus_next', // Nintendo 64
        'psx': 'pcsx_rearmed',     // PlayStation 1
        'pce': 'mednafen_pce',     // PC Engine/TurboGrafx-16
        'arcade': 'fbneo',         // Arcade
        'segaCD': 'genesis_plus_gx', // Sega CD
        'segaGG': 'genesis_plus_gx', // Game Gear
        'segaMS': 'smsplus',       // Master System
        'sega32x': 'picodrive',    // Sega 32X
        'segaSaturn': 'yabause',   // Sega Saturn
        'atari2600': 'stella2014', // Atari 2600
        'atari7800': 'prosystem',  // Atari 7800
        'lynx': 'handy',           // Atari Lynx
        'jaguar': 'virtualjaguar', // Atari Jaguar
        'nds': 'melonds',          // Nintendo DS
        'vb': 'beetle_vb',         // Virtual Boy
        'a5200': 'a5200',          // Atari 5200
        '3do': 'opera',            // 3DO
        'c64': 'vice_x64sc',       // Commodore 64
        'amiga': 'puae',           // Amiga
        'coleco': 'gearcoleco',    // ColecoVision
        'pcfx': 'mednafen_pcfx',   // PC-FX
        'ngp': 'mednafen_ngp',     // Neo Geo Pocket
        'ws': 'mednafen_wswan',    // WonderSwan
        'psp': 'ppsspp'            // PlayStation Portable
    };
    
    return coreMapping[romSystem] || 'fbneo';
};

/**
 * Gets supported ROM file extensions
 * @returns {string[]} - Array of supported file extensions
 */
const getSupportedRomExtensions = () => {
    return [
        '.nes', '.snes', '.sfc', '.smc', '.gba', '.gb', '.gbc',
        '.md', '.gen', '.smd', '.32x', '.gg', '.sms',
        '.n64', '.z64', '.v64', '.bin', '.cue', '.iso',
        '.pce', '.nds', '.vb', '.a52', '.lnx', '.j64',
        '.3do', '.d64', '.adf', '.col', '.ngp', '.ws',
        '.wsc', '.pbp', '.cso', '.zip'
    ];
};

/**
 * Validates if a file is a supported ROM format
 * @param {string} filename - The filename to validate
 * @returns {boolean} - True if supported ROM format
 */
const isSupportedRomFile = (filename) => {
    const ext = path.extname(filename).toLowerCase();
    return getSupportedRomExtensions().includes(ext);
};

export {
    detectRomSystem,
    detectRomSystemFromZip,
    detectRomSystemFromZipBuffer,
    analyzeFileExtensions,
    isIgnoredFile,
    mapRomSystemToCore,
    getSupportedRomExtensions,
    isSupportedRomFile
};