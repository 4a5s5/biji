<<<<<<< HEAD
// Ensure required directories exist
// 确保必要目录存在

const fs = require('fs').promises;
const path = require('path');

async function ensureDirectories() {
    const directories = [
        'uploads',
        'data/images',
        'data',
        'exports',
        '.tesseract-cache'
    ];
    
    console.log('📁 Ensuring required directories exist...');
    
    for (const dir of directories) {
        const fullPath = path.join(__dirname, dir);
        try {
            await fs.mkdir(fullPath, { recursive: true });
            console.log(`✅ Directory ensured: ${dir}`);
        } catch (error) {
            console.log(`⚠️ Failed to create directory ${dir}:`, error.message);
        }
    }
    
    console.log('📁 Directory check completed');
}

if (require.main === module) {
    ensureDirectories().catch(console.error);
}

module.exports = ensureDirectories;
=======
// Ensure required directories exist
// 确保必要目录存在

const fs = require('fs').promises;
const path = require('path');

async function ensureDirectories() {
    const directories = [
        'uploads',
        'data/images',
        'data',
        'exports',
        '.tesseract-cache'
    ];
    
    console.log('📁 Ensuring required directories exist...');
    
    for (const dir of directories) {
        const fullPath = path.join(__dirname, dir);
        try {
            await fs.mkdir(fullPath, { recursive: true });
            console.log(`✅ Directory ensured: ${dir}`);
        } catch (error) {
            console.log(`⚠️ Failed to create directory ${dir}:`, error.message);
        }
    }
    
    console.log('📁 Directory check completed');
}

if (require.main === module) {
    ensureDirectories().catch(console.error);
}

module.exports = ensureDirectories;
>>>>>>> 4968ea3f9483d2f955ef2f1cf8604552ed463aa7
