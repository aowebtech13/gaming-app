/**
 * JSON-LD Structured Data Utility
 * Generates structured data markup for SEO optimization
 */

import crypto from 'crypto';

class JsonLdGenerator {
    constructor(baseUrl, siteName) {
        this.baseUrl = baseUrl || '';
        this.siteName = siteName || 'ARCADE';
    }

    /**
     * Generate Organization schema
     */
    generateOrganization(data) {
        return {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": data.name,
            "alternateName": data.alternateName || data.name,
            "url": this.baseUrl,
            "logo": data.logo ? `${this.baseUrl}${data.logo}` : undefined,
            "sameAs": data.socialLinks || [],
            "description": data.description
        };
    }

    /**
     * Generate WebSite schema with search action
     */
    generateWebSite(data) {
        return {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": data.name,
            "alternateName": data.alternateName || data.name,
            "url": this.baseUrl,
            "potentialAction": {
                "@type": "SearchAction",
                "target": {
                    "@type": "EntryPoint",
                    "urlTemplate": `${this.baseUrl}/search/{search_term_string}`
                },
                "query-input": "required name=search_term_string"
            }
        };
    }

    /**
     * Generate Game/VideoGame schema
     */
    generateGame(game) {
        const schema = {
            "@context": "https://schema.org",
            "@type": "VideoGame",
            "name": game.title,
            "description": game.instructions || game.description || `Play ${game.title} online`,
            "url": `${this.baseUrl}/play/${game.slug}`,
            "datePublished": game.created_at,
            "dateModified": game.updated_at,
            "gamePlatform": "Web Browser",
            "applicationCategory": "Game",
            "operatingSystem": "Any",
            "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
            }
        };

        if (game.thumbnail) {
            let imageUrl = null;
            
            // Check if thumbnail is a JSON string (new format)
            if (typeof game.thumbnail === 'string' && game.thumbnail.startsWith('{')) {
                try {
                    const thumbnailData = JSON.parse(game.thumbnail);
                    // Use WebP standard size for best quality/performance balance
                    if (thumbnailData.webp && thumbnailData.webp.standard) {
                        imageUrl = thumbnailData.webp.standard.relativePath;
                    } 
                    // Fallback to original standard size
                    else if (thumbnailData.original && thumbnailData.original.standard) {
                        imageUrl = thumbnailData.original.standard.relativePath;
                    }
                    // Fallback to WebP thumbnail
                    else if (thumbnailData.webp && thumbnailData.webp.thumbnail) {
                        imageUrl = thumbnailData.webp.thumbnail.relativePath;
                    }
                    // Fallback to original thumbnail
                    else if (thumbnailData.original && thumbnailData.original.thumbnail) {
                        imageUrl = thumbnailData.original.thumbnail.relativePath;
                    }
                } catch (e) {
                    // If JSON parsing fails, treat as simple path
                    imageUrl = game.thumbnail;
                }
            } else {
                // Simple string path (legacy format)
                imageUrl = game.thumbnail;
            }
            
            if (imageUrl) {
                schema.image = `${this.baseUrl}/${imageUrl}`;
            }
        }

        if (game.category_name) {
            schema.genre = game.category_name;
        }

        if (game.developer) {
            schema.creator = {
                "@type": "Organization",
                "name": game.developer
            };
        }

        if (game.rating && game.rating_count) {
            schema.aggregateRating = {
                "@type": "AggregateRating",
                "ratingValue": game.rating,
                "ratingCount": game.rating_count,
                "bestRating": "5",
                "worstRating": "1"
            };
        }

        return schema;
    }

    /**
     * Generate Article schema for custom pages
     */
    generateArticle(page, author) {
        const schema = {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": page.title,
            "url": `${this.baseUrl}/page/${page.slug}`,
            "datePublished": page.created_at,
            "dateModified": page.updated_at,
            "mainEntityOfPage": {
                "@type": "WebPage",
                "@id": `${this.baseUrl}/page/${page.slug}`
            }
        };

        if (page.content) {
            // Strip HTML for description
            const tempDiv = { textContent: page.content.replace(/<[^>]*>/g, '') };
            schema.description = tempDiv.textContent.substring(0, 160);
            schema.articleBody = page.content;
        }

        if (author) {
            schema.author = {
                "@type": "Person",
                "name": author.username || author.fullname,
                "url": `${this.baseUrl}/profile/${author.username}`
            };
        }

        schema.publisher = {
            "@type": "Organization",
            "name": this.siteName || "ARCADE",
            "url": this.baseUrl
        };

        return schema;
    }

    /**
     * Generate Person schema for user profiles
     */
    generatePerson(user) {
        const schema = {
            "@context": "https://schema.org",
            "@type": "Person",
            "name": user.fullname || user.username,
            "alternateName": user.username,
            "url": `${this.baseUrl}/profile/${user.username}`,
            "memberOf": {
                "@type": "Organization",
                "name": this.siteName,
                "url": this.baseUrl
            }
        };

        if (user.bio) {
            schema.description = user.bio;
        }

        if (user.avatar || user.email) {
            const emailHash = user.email ? crypto.createHash('md5').update(user.email.toLowerCase()).digest('hex') : null;
            schema.image = user.avatar || (emailHash ? `https://www.gravatar.com/avatar/${emailHash}?d=mp&s=200` : undefined);
        }

        if (user.location) {
            schema.address = {
                "@type": "PostalAddress",
                "addressCountry": user.location
            };
        }

        if (user.created_at) {
            schema.memberSince = user.created_at;
        }

        return schema;
    }

    /**
     * Generate BreadcrumbList schema
     */
    generateBreadcrumb(items) {
        const breadcrumbItems = items.map((item, index) => ({
            "@type": "ListItem",
            "position": index + 1,
            "name": item.name,
            "item": item.url ? `${this.baseUrl}${item.url}` : undefined
        }));

        return {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": breadcrumbItems
        };
    }

    /**
     * Generate CollectionPage schema for category pages
     */
    generateCollectionPage(category, games) {
        return {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": `${category.name} Games`,
            "description": category.description || `Play ${category.name} games online for free`,
            "url": `${this.baseUrl}/category/${category.slug}`,
            "mainEntity": {
                "@type": "ItemList",
                "numberOfItems": games.length,
                "itemListElement": games.map((game, index) => ({
                    "@type": "ListItem",
                    "position": index + 1,
                    "item": {
                        "@type": "VideoGame",
                        "name": game.title,
                        "url": `${this.baseUrl}/play/${game.slug}`
                    }
                }))
            }
        };
    }

    /**
     * Generate SearchResultsPage schema
     */
    generateSearchResultsPage(query, results) {
        return {
            "@context": "https://schema.org",
            "@type": "SearchResultsPage",
            "name": `Search results for: ${query}`,
            "url": `${this.baseUrl}/search/${encodeURIComponent(query)}`,
            "mainEntity": {
                "@type": "ItemList",
                "numberOfItems": results.length,
                "itemListElement": results.map((game, index) => ({
                    "@type": "ListItem",
                    "position": index + 1,
                    "item": {
                        "@type": "VideoGame",
                        "name": game.title,
                        "url": `${this.baseUrl}/play/${game.slug}`
                    }
                }))
            }
        };
    }

    /**
     * Convert schema object to JSON-LD script tag
     */
    toScriptTag(schema) {
        return `<script type="application/ld+json">${JSON.stringify(schema, null, 2)}</script>`;
    }

    /**
     * Generate multiple schemas and combine them
     */
    generateMultiple(schemas) {
        return schemas.map(schema => this.toScriptTag(schema)).join('\n');
    }
}

export default JsonLdGenerator;