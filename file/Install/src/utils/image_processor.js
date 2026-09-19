import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { consoleLog } from './logger.js';

class ImageProcessor {
    constructor() {
        this.quality = {
            webp: 85,
            jpeg: 90,
            png: 90
        };
        
        this.sizes = {
            games: {
                thumbnail: { width: 200, height: 200 },
                standard: { width: 400, height: 400 },
                large: { width: 600, height: 600 }
            },
            categories: {
                thumbnail: { width: 320, height: 180 },
                standard: { width: 640, height: 360 },
                large: { width: 960, height: 540 }
            },
            logos: {
                standard: { width: 200, height: 60 },
                large: { width: 400, height: 120 },
                icon: { width: 64, height: 64 }
            },
            favicons: {
                small: { width: 16, height: 16 },
                standard: { width: 32, height: 32 },
                apple: { width: 180, height: 180 },
                android: { width: 192, height: 192 },
                pwa: { width: 512, height: 512 }
            },
            avatars: {
                thumbnail: { width: 80, height: 80 },
                standard: { width: 200, height: 200 },
                large: { width: 400, height: 400 }
            }
        };
    }

    /**
     * Process uploaded image and create optimized versions
     * @param {Buffer} buffer - Image buffer
     * @param {string} originalName - Original filename
     * @param {string} type - Image type ('games', 'categories', 'logos', or 'favicons')
     * @param {string} baseDir - Base directory for saving images
     * @param {string} slug - Slug for filename
     * @returns {Promise<Object>} Processed image paths and metadata
     */
    async processImage(buffer, originalName, type, baseDir, slug) {
        try {
            const sharpInstance = sharp(buffer);
            const metadata = await sharpInstance.metadata();
            
            // Validate image
            if (!metadata.width || !metadata.height) {
                throw new Error('Invalid image file');
            }

            const originalExtension = path.extname(originalName).toLowerCase();
            const typeNames = {
                'games': 'game',
                'categories': 'category', 
                'logos': 'logo',
                'favicons': 'favicon',
                'avatars': 'avatar'
            };
            const baseName = `${typeNames[type] || type}_${slug}_${Date.now()}`;
            
            // Ensure directory exists
            if (!fs.existsSync(baseDir)) {
                fs.mkdirSync(baseDir, { recursive: true });
            }

            const results = {
                original: {},
                webp: {},
                metadata: {
                    width: metadata.width,
                    height: metadata.height,
                    format: metadata.format,
                    size: buffer.length
                }
            };

            const imageSizes = this.sizes[type];
            
            // Process each size
            for (const [sizeName, dimensions] of Object.entries(imageSizes)) {
                // Determine resize fit strategy based on type
                let fitStrategy, backgroundColor;
                if (type === 'games') {
                    fitStrategy = 'contain';
                    backgroundColor = { r: 255, g: 255, b: 255, alpha: 1 };
                } else if (type === 'logos') {
                    fitStrategy = 'contain';
                    backgroundColor = { r: 255, g: 255, b: 255, alpha: 0 }; // Transparent for logos
                } else if (type === 'favicons') {
                    fitStrategy = 'cover';
                    backgroundColor = { r: 255, g: 255, b: 255, alpha: 1 };
                } else if (type === 'avatars') {
                    fitStrategy = 'cover';
                    backgroundColor = { r: 255, g: 255, b: 255, alpha: 1 };
                } else {
                    fitStrategy = 'cover';
                    backgroundColor = { r: 255, g: 255, b: 255, alpha: 1 };
                }

                const resizedSharp = sharp(buffer)
                    .resize(dimensions.width, dimensions.height, {
                        fit: fitStrategy,
                        position: 'center',
                        background: backgroundColor
                    });

                // Create WebP version
                const webpFilename = `${baseName}_${sizeName}.webp`;
                const webpPath = path.join(baseDir, webpFilename);
                
                await resizedSharp
                    .clone()
                    .webp({ quality: this.quality.webp })
                    .toFile(webpPath);

                results.webp[sizeName] = {
                    filename: webpFilename,
                    relativePath: path.relative(process.cwd(), webpPath).replace(/\\/g, '/'),
                    width: dimensions.width,
                    height: dimensions.height
                };

                // Create original format version
                const originalFilename = `${baseName}_${sizeName}${originalExtension}`;
                const originalPath = path.join(baseDir, originalFilename);
                
                if (originalExtension === '.jpg' || originalExtension === '.jpeg') {
                    await resizedSharp
                        .clone()
                        .jpeg({ quality: this.quality.jpeg, progressive: true })
                        .toFile(originalPath);
                } else if (originalExtension === '.png') {
                    await resizedSharp
                        .clone()
                        .png({ quality: this.quality.png, compressionLevel: 9 })
                        .toFile(originalPath);
                } else {
                    // For other formats, convert to JPEG
                    await resizedSharp
                        .clone()
                        .jpeg({ quality: this.quality.jpeg, progressive: true })
                        .toFile(originalPath);
                }

                results.original[sizeName] = {
                    filename: originalFilename,
                    relativePath: path.relative(process.cwd(), originalPath).replace(/\\/g, '/'),
                    width: dimensions.width,
                    height: dimensions.height
                };
            }

            consoleLog('success', 'Image processed successfully', { 
                type, 
                slug, 
                originalSize: buffer.length,
                sizes: Object.keys(imageSizes) 
            });

            return results;

        } catch (error) {
            consoleLog('error', 'Image processing failed', { 
                error: error.message,
                type,
                slug 
            });
            throw error;
        }
    }

    /**
     * Process single image without multiple sizes (for legacy support)
     * @param {Buffer} buffer - Image buffer
     * @param {string} originalName - Original filename
     * @param {string} outputPath - Output file path
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} Processed image info
     */
    async processSimpleImage(buffer, originalName, outputPath, options = {}) {
        try {
            const {
                width = null,
                height = null,
                quality = 85,
                format = 'webp'
            } = options;

            const sharpInstance = sharp(buffer);
            
            if (width && height) {
                sharpInstance.resize(width, height, {
                    fit: 'cover',
                    position: 'center'
                });
            }

            // Process based on format
            if (format === 'webp') {
                await sharpInstance
                    .webp({ quality })
                    .toFile(outputPath);
            } else if (format === 'jpeg') {
                await sharpInstance
                    .jpeg({ quality, progressive: true })
                    .toFile(outputPath);
            } else if (format === 'png') {
                await sharpInstance
                    .png({ quality, compressionLevel: 9 })
                    .toFile(outputPath);
            }

            const metadata = await sharp(outputPath).metadata();
            
            return {
                relativePath: path.relative(process.cwd(), outputPath).replace(/\\/g, '/'),
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                size: fs.statSync(outputPath).size
            };

        } catch (error) {
            consoleLog('error', 'Simple image processing failed', { 
                error: error.message,
                outputPath 
            });
            throw error;
        }
    }

    /**
     * Generate responsive image HTML
     * @param {Object} imageData - Image data with webp and original paths
     * @param {string} alt - Alt text
     * @param {string} className - CSS classes
     * @returns {string} HTML picture element
     */
    generatePictureHTML(imageData, alt = '', className = '') {
        if (!imageData || !imageData.webp || !imageData.original) {
            return `<img src="/assets/images/default-avatar.jpg" alt="${alt}" class="${className}" />`;
        }

        const sizes = Object.keys(imageData.webp);
        const defaultSize = sizes.includes('standard') ? 'standard' : sizes[0];
        
        let html = `<picture class="${className}">`;
        
        // WebP sources
        for (const size of sizes) {
            const webpImage = imageData.webp[size];
            const mediaQuery = this.getMediaQuery(size);
            
            html += `<source srcset="/${webpImage.relativePath}" type="image/webp" ${mediaQuery ? `media="${mediaQuery}"` : ''}>`;
        }
        
        // Fallback sources
        for (const size of sizes) {
            const originalImage = imageData.original[size];
            const mediaQuery = this.getMediaQuery(size);
            
            html += `<source srcset="/${originalImage.relativePath}" ${mediaQuery ? `media="${mediaQuery}"` : ''}>`;
        }
        
        // Default fallback
        const defaultImage = imageData.original[defaultSize];
        html += `<img src="/${defaultImage.relativePath}" alt="${alt}" loading="lazy">`;
        html += '</picture>';
        
        return html;
    }

    /**
     * Get media query for responsive images
     * @param {string} size - Size name
     * @returns {string} Media query string
     */
    getMediaQuery(size) {
        const queries = {
            large: '(min-width: 1200px)',
            standard: '(min-width: 768px)',
            thumbnail: '(max-width: 767px)'
        };
        
        return queries[size] || '';
    }

    /**
     * Clean up old image files
     * @param {string} directory - Directory to clean
     * @param {string} pattern - File pattern to match
     */
    async cleanupOldImages(directory, pattern) {
        try {
            if (!fs.existsSync(directory)) {
                return;
            }

            const files = fs.readdirSync(directory);
            const regex = new RegExp(pattern);
            
            for (const file of files) {
                if (regex.test(file)) {
                    const filePath = path.join(directory, file);
                    fs.unlinkSync(filePath);
                }
            }
            
            consoleLog('info', 'Cleaned up old images', { directory, pattern });
        } catch (error) {
            consoleLog('error', 'Failed to cleanup old images', { error: error.message });
        }
    }

    /**
     * Process avatar image and create optimized versions
     * @param {Buffer} buffer - Image buffer
     * @param {string} originalName - Original filename
     * @param {string} userId - User ID for filename
     * @returns {Promise<Object>} Processed avatar paths and metadata
     */
    async processAvatar(buffer, originalName, userId) {
        try {
            const baseDir = path.join(process.cwd(), 'uploads', 'avatars');
            const slug = `user_${userId}`;
            
            // Validate image size (5MB limit)
            if (buffer.length > 5 * 1024 * 1024) {
                throw new Error('Image must be smaller than 5MB');
            }
            
            // Validate image format
            const sharpInstance = sharp(buffer);
            const metadata = await sharpInstance.metadata();
            
            const allowedFormats = ['jpeg', 'jpg', 'png', 'gif', 'webp'];
            if (!allowedFormats.includes(metadata.format)) {
                throw new Error('Please upload a valid image file (PNG, JPG, GIF)');
            }
            
            // Clean up old avatar files for this user
            await this.cleanupOldImages(baseDir, `avatar_user_${userId}_.*`);
            
            // Process avatar with our standard image processing
            const result = await this.processImage(buffer, originalName, 'avatars', baseDir, slug);
            
            // Return the standard size path for saving to database - make it web accessible
            const avatarUrl = result.webp.standard.relativePath.replace('uploads/', '/uploads/');
            
            return {
                avatarUrl,
                metadata: result.metadata,
                processed: result
            };
            
        } catch (error) {
            consoleLog('error', 'Avatar processing failed', { 
                error: error.message,
                userId 
            });
            throw error;
        }
    }

    /**
     * Get optimized image URL based on browser support
     * @param {Object} imageData - Image data
     * @param {string} size - Size preference
     * @param {boolean} supportsWebP - Browser supports WebP
     * @returns {string} Image URL
     */
    getOptimizedImageUrl(imageData, size = 'standard', supportsWebP = true) {
        if (!imageData || !imageData.webp || !imageData.original) {
            return '/assets/images/default-avatar.jpg';
        }

        const sizeData = supportsWebP ? imageData.webp[size] : imageData.original[size];
        
        if (!sizeData) {
            // Fallback to available size
            const availableSizes = Object.keys(supportsWebP ? imageData.webp : imageData.original);
            const fallbackSize = availableSizes.includes('standard') ? 'standard' : availableSizes[0];
            const fallbackData = supportsWebP ? imageData.webp[fallbackSize] : imageData.original[fallbackSize];
            return `/${fallbackData.relativePath}`;
        }

        return `/${sizeData.relativePath}`;
    }
}

export default new ImageProcessor();