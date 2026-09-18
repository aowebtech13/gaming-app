import fs from 'fs';
import path from 'path';

const fileExists = async (filePath) => {
    return new Promise((resolve, reject) => {
        fs.access(filePath, fs.constants.F_OK, (err) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    resolve(false); // File does not exist
                } else {
                    reject(err); // Other error
                }
            } else {
                resolve(true); // File exists
            }
        });
    });
};

const deleteFile = async (filePath) => {
    return new Promise((resolve, reject) => {
        fs.unlink(filePath, (err) => {
            if (err) {
                reject(err); // Error while deleting file
            } else {
                resolve(); // File deleted successfully
            }
        });
    });
};

const makeDir = async (dirPath) => {
    return new Promise((resolve, reject) => {
        fs.mkdir(dirPath, { recursive: true }, (err) => {
            if (err) {
                reject(err); // Error while creating directory
            } else {
                resolve(); // Directory created successfully
            }
        });
    });
};

const deleteFolder = async (folderPath) => {
    return new Promise((resolve, reject) => {
        fs.rmdir(folderPath, { recursive: true }, (err) => {
            if (err) {
                reject(err); // Error while deleting folder
            } else {
                resolve(); // Folder deleted successfully
            }
        });
    });
};

export {
    fileExists,
    deleteFile,
    makeDir,
    deleteFolder
};
