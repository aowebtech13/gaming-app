import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { consoleLog } from './logger.js';
import { getAllGames } from '../models/games.js';

class ThumbnailGridGenerator {
    constructor() {
        this.outputDir = 'public/assets/images/social';
        this.gridSize = { width: 1200, height: 630 }; // Standard social media image size
        this.thumbnailSize = { width: 150, height: 113 }; // Aspect ratio for game thumbnails
        this.spacing = 10;
        this.maxGames = 24; // 6x4 grid
    }

    /**
     * Ensure output directory exists
     */
    async ensureOutputDirectory() {
        try {
            await fs.mkdir(this.outputDir, { recursive: true });
        } catch (error) {
            consoleLog('error', 'Failed to create output directory', { error: error.message });
            throw error;
        }
    }

    /**
     * Extract image path from game thumbnail metadata
     */
    extractImagePath(thumbnailData) {
        if (!thumbnailData) return null;

        try {
            // Handle JSON string
            if (typeof thumbnailData === 'string' && thumbnailData.startsWith('{')) {
                const parsed = JSON.parse(thumbnailData);
                
                // Priority: WebP standard > WebP thumbnail > Original standard > Original thumbnail
                if (parsed.webp?.standard?.relativePath) {
                    return parsed.webp.standard.relativePath;
                }
                if (parsed.webp?.thumbnail?.relativePath) {
                    return parsed.webp.thumbnail.relativePath;
                }
                if (parsed.original?.standard?.relativePath) {
                    return parsed.original.standard.relativePath;
                }
                if (parsed.original?.thumbnail?.relativePath) {
                    return parsed.original.thumbnail.relativePath;
                }
            }
            
            // Handle direct path string
            if (typeof thumbnailData === 'string' && !thumbnailData.startsWith('{')) {
                return thumbnailData;
            }
            
            return null;
        } catch (error) {
            consoleLog('warn', 'Failed to parse thumbnail data', { 
                thumbnailData: thumbnailData?.substring(0, 100) + '...',
                error: error.message 
            });
            return null;
        }
    }

    /**
     * Get the most popular games for the grid
     */
    async getPopularGames(limit = this.maxGames) {
        try {
            const games = await getAllGames();
            
            // Filter games with thumbnails and sort by play count
            const gamesWithThumbnails = games
                .filter(game => {
                    const imagePath = this.extractImagePath(game.thumbnail);
                    return imagePath && game.is_active;
                })
                .sort((a, b) => (b.play_count || 0) - (a.play_count || 0))
                .slice(0, limit);

            return gamesWithThumbnails;
        } catch (error) {
            consoleLog('error', 'Failed to get popular games', { error: error.message });
            throw error;
        }
    }

    /**
     * Process a single game thumbnail
     */
    async processGameThumbnail(game) {
        try {
            const imagePath = this.extractImagePath(game.thumbnail);
            if (!imagePath) {
                throw new Error('No valid image path found');
            }

            const fullPath = path.join(imagePath);
            
            // Check if file exists
            try {
                await fs.access(fullPath);
            } catch {
                throw new Error(`Image file not found: ${fullPath}`);
            }

            // Process image with Sharp
            const processedBuffer = await sharp(fullPath)
                .resize(this.thumbnailSize.width, this.thumbnailSize.height, {
                    fit: 'cover',
                    position: 'center'
                })
                .jpeg({ quality: 85 })
                .toBuffer();

            return {
                buffer: processedBuffer,
                game: {
                    id: game.id,
                    title: game.title,
                    slug: game.slug
                }
            };
        } catch (error) {
            consoleLog('warn', `Failed to process thumbnail for game ${game.title}`, { 
                gameId: game.id,
                error: error.message 
            });
            return null;
        }
    }

    /**
     * Create a fallback thumbnail for missing images
     */
    async createFallbackThumbnail(game) {
        try {
            // Create a simple colored rectangle with game title
            const svg = `
                <svg width="${this.thumbnailSize.width}" height="${this.thumbnailSize.height}" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
                            <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
                        </linearGradient>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grad)"/>
                    <text x="50%" y="50%" font-family="Inter, Arial, sans-serif" font-size="12" 
                          fill="white" text-anchor="middle" dominant-baseline="middle">
                        ${game.title.length > 20 ? game.title.substring(0, 17) + '...' : game.title}
                    </text>
                </svg>
            `;

            const buffer = await sharp(Buffer.from(svg))
                .jpeg({ quality: 85 })
                .toBuffer();

            return {
                buffer: buffer,
                game: {
                    id: game.id,
                    title: game.title,
                    slug: game.slug
                }
            };
        } catch (error) {
            consoleLog('error', `Failed to create fallback thumbnail for game ${game.title}`, { 
                gameId: game.id,
                error: error.message 
            });
            return null;
        }
    }

    /**
     * Generate the thumbnail grid
     */
    async generateGrid() {
        try {
            await this.ensureOutputDirectory();
            
            const games = await this.getPopularGames();
            
            if (games.length === 0) {
                throw new Error('No games with thumbnails found');
            }

            consoleLog('info', `Generating thumbnail grid with ${games.length} games`);

            // Process all thumbnails
            const thumbnailPromises = games.map(game => this.processGameThumbnail(game));
            const thumbnailResults = await Promise.all(thumbnailPromises);
            
            // Filter out failed thumbnails and create fallbacks if needed
            const thumbnails = [];
            for (let i = 0; i < games.length; i++) {
                const result = thumbnailResults[i];
                if (result) {
                    thumbnails.push(result);
                } else {
                    // Create fallback thumbnail
                    const fallback = await this.createFallbackThumbnail(games[i]);
                    if (fallback) {
                        thumbnails.push(fallback);
                    }
                }
            }

            if (thumbnails.length === 0) {
                throw new Error('No valid thumbnails could be generated');
            }

            // Calculate grid dimensions
            const cols = Math.min(6, Math.ceil(Math.sqrt(thumbnails.length)));
            const rows = Math.ceil(thumbnails.length / cols);
            
            const gridWidth = this.gridSize.width;
            const gridHeight = this.gridSize.height;
            
            // Calculate actual thumbnail size to fit grid
            const availableWidth = gridWidth - (this.spacing * (cols + 1));
            const availableHeight = gridHeight - (this.spacing * (rows + 1));
            
            const thumbWidth = Math.floor(availableWidth / cols);
            const thumbHeight = Math.floor(availableHeight / rows);

            // Create base canvas
            const canvas = sharp({
                create: {
                    width: gridWidth,
                    height: gridHeight,
                    channels: 3,
                    background: { r: 15, g: 23, b: 42 } // Dark blue background
                }
            });

            // Prepare composite operations
            const compositeOps = [];
            
            for (let i = 0; i < thumbnails.length; i++) {
                const row = Math.floor(i / cols);
                const col = i % cols;
                
                const x = this.spacing + (col * (thumbWidth + this.spacing));
                const y = this.spacing + (row * (thumbHeight + this.spacing));

                // Resize thumbnail to fit grid
                const resizedThumbnail = await sharp(thumbnails[i].buffer)
                    .resize(thumbWidth, thumbHeight, {
                        fit: 'cover',
                        position: 'center'
                    })
                    .toBuffer();

                compositeOps.push({
                    input: resizedThumbnail,
                    top: y,
                    left: x
                });
            }

            // Generate the final grid
            const outputPath = path.join(this.outputDir, 'homepage-grid.jpg');
            await canvas
                .composite(compositeOps)
                .jpeg({ quality: 90 })
                .toFile(outputPath);

            // Generate metadata
            const metadata = {
                generatedAt: new Date().toISOString(),
                gameCount: thumbnails.length,
                games: thumbnails.map(t => t.game),
                dimensions: { width: gridWidth, height: gridHeight },
                gridLayout: { cols, rows }
            };

            const metadataPath = path.join(this.outputDir, 'homepage-grid-metadata.json');
            await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

            consoleLog('info', 'Thumbnail grid generated successfully', {
                outputPath,
                gameCount: thumbnails.length,
                dimensions: `${gridWidth}x${gridHeight}`,
                layout: `${cols}x${rows}`
            });

            return {
                imagePath: `/assets/images/social/homepage-grid.jpg`,
                metadata,
                success: true
            };

        } catch (error) {
            consoleLog('error', 'Failed to generate thumbnail grid', { error: error.message });
            throw error;
        }
    }

    /**
     * Get the current grid metadata
     */
    async getGridMetadata() {
        try {
            const metadataPath = path.join(this.outputDir, 'homepage-grid-metadata.json');
            const data = await fs.readFile(metadataPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return null;
        }
    }

    /**
     * Check if grid needs regeneration (older than 7 days or missing)
     */
    async needsRegeneration() {
        try {
            const metadata = await this.getGridMetadata();
            if (!metadata) return true;

            const generatedAt = new Date(metadata.generatedAt);
            const now = new Date();
            const daysSinceGeneration = (now - generatedAt) / (1000 * 60 * 60 * 24);

            return daysSinceGeneration > 7;
        } catch (error) {
            return true;
        }
    }
}

export default ThumbnailGridGenerator;