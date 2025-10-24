// API客户端 - 与服务器通信
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

class ApiClient {
    constructor(serverUrl = 'https://xhbahrcgycil.ap-northeast-1.clawcloudrun.com') {
        console.log('ApiClient 构造函数 - 收到的serverUrl:', serverUrl);
        this.serverUrl = serverUrl.replace(/\/$/, ''); // 移除尾部斜杠
        console.log('ApiClient 构造函数 - 处理后的serverUrl:', this.serverUrl);
        this.timeout = 45000; // 45秒超时，增加等待时间
        
        // 创建axios实例
        this.client = axios.create({
            baseURL: this.serverUrl,
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Smart Note Collector Windows Client/1.0.0'
            }
        });
        
        // 设置响应拦截器处理错误
        this.client.interceptors.response.use(
            response => response,
            error => {
                console.error('API请求失败:', error.message);
                if (error.response) {
                    console.error('错误状态:', error.response.status);
                    console.error('错误数据:', error.response.data);
                }
                return Promise.reject(this.formatError(error));
            }
        );
    }
    
    // 格式化错误信息
    formatError(error) {
        if (error.response) {
            return new Error(`HTTP ${error.response.status}: ${error.response.data?.error || error.response.statusText}`);
        } else if (error.code === 'ECONNREFUSED') {
            return new Error('无法连接到服务器，请检查服务器是否启动');
        } else if (error.code === 'ETIMEDOUT') {
            return new Error('请求超时，请检查网络连接');
        } else {
            return new Error(error.message || '未知错误');
        }
    }
    
    // 更新服务器地址
    updateServerUrl(newServerUrl) {
        this.serverUrl = newServerUrl.replace(/\/$/, '');
        this.client.defaults.baseURL = this.serverUrl;
        console.log('服务器地址已更新为:', this.serverUrl);
    }
    
    // 测试服务器连接
    async testConnection() {
        try {
            const response = await this.client.get('/api/health');
            return {
                connected: true,
                status: response.status,
                data: response.data
            };
        } catch (error) {
            return {
                connected: false,
                error: error.message
            };
        }
    }
    
    // =================
    // 笔记相关API
    // =================
    
    // 保存笔记（快速导入）
    async saveNote(noteData, retryCount = 3) {
        let lastError = null;

        for (let attempt = 1; attempt <= retryCount; attempt++) {
            try {
                console.log(`保存笔记到服务器 (尝试 ${attempt}/${retryCount}):`, noteData.title);

                const response = await this.client.post('/api/quick-import', {
                    title: noteData.title,
                    content: noteData.content,
                    theme: noteData.theme || 'default',
                    tags: noteData.tags || [],
                    source: noteData.source || null
                });

                console.log('笔记保存成功:', response.data);
                return response.data;

            } catch (error) {
                lastError = error;
                console.warn(`保存笔记失败，尝试 ${attempt}/${retryCount}:`, error.message);

                // 如果是最后一次尝试，直接抛出错误
                if (attempt === retryCount) {
                    break;
                }

                // 如果是网络超时错误，等待后重试
                if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' ||
                    (error.response && error.response.status >= 500)) {
                    const waitTime = attempt * 1000; // 1s, 2s, 3s
                    console.log(`等待 ${waitTime}ms 后重试...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                } else {
                    // 非网络错误，直接抛出
                    break;
                }
            }
        }

        console.error('保存笔记最终失败:', lastError.message);
        throw lastError;
    }
    
    // 批量保存笔记
    async saveNoteBatch(notesArray) {
        try {
            console.log('批量保存笔记:', notesArray.length, '条');
            
            const response = await this.client.post('/api/quick-import/batch', {
                notes: notesArray
            });
            
            console.log('批量保存完成:', response.data);
            return response.data;
        } catch (error) {
            console.error('批量保存笔记失败:', error);
            throw error;
        }
    }
    
    // 获取笔记列表
    async getNotes(options = {}, retryCount = 3) {
        let lastError = null;

        for (let attempt = 1; attempt <= retryCount; attempt++) {
            try {
                console.log(`获取笔记列表 (尝试 ${attempt}/${retryCount})`);

                const params = {
                    page: options.page || 1,
                    limit: options.limit || 20,
                    theme: options.theme || undefined,
                    search: options.search || undefined,
                    tags: options.tags || undefined
                };

                // 移除undefined值
                Object.keys(params).forEach(key => {
                    if (params[key] === undefined) {
                        delete params[key];
                    }
                });

                const response = await this.client.get('/api/notes', { params });
                console.log('获取笔记列表成功:', response.data.notes?.length || 0, '条笔记');
                return response.data;

            } catch (error) {
                lastError = error;
                console.warn(`获取笔记列表失败，尝试 ${attempt}/${retryCount}:`, error.message);

                // 如果是最后一次尝试，直接抛出错误
                if (attempt === retryCount) {
                    break;
                }

                // 如果是网络超时错误，等待后重试
                if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' ||
                    (error.response && error.response.status >= 500)) {
                    const waitTime = attempt * 1000; // 1s, 2s, 3s
                    console.log(`等待 ${waitTime}ms 后重试...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                } else {
                    // 非网络错误，直接抛出
                    break;
                }
            }
        }

        console.error('获取笔记列表最终失败:', lastError.message);
        throw lastError;
    }
    
    // 获取单个笔记
    async getNote(noteId) {
        try {
            const response = await this.client.get(`/api/notes/${noteId}`);
            return response.data;
        } catch (error) {
            console.error('获取笔记失败:', error);
            throw error;
        }
    }
    
    // 更新笔记
    async updateNote(noteId, noteData) {
        try {
            const response = await this.client.put(`/api/notes/${noteId}`, noteData);
            return response.data;
        } catch (error) {
            console.error('更新笔记失败:', error);
            throw error;
        }
    }
    
    // 删除笔记
    async deleteNote(noteId) {
        try {
            const response = await this.client.delete(`/api/notes/${noteId}`);
            return response.data;
        } catch (error) {
            console.error('删除笔记失败:', error);
            throw error;
        }
    }
    
    // =================
    // 主题相关API
    // =================
    
    // 获取主题列表
    async getThemes(retryCount = 3) {
        let lastError = null;

        for (let attempt = 1; attempt <= retryCount; attempt++) {
            try {
                console.log(`获取主题列表 (尝试 ${attempt}/${retryCount})`);

                const response = await this.client.get('/api/themes');
                console.log('获取主题列表成功:', response.data.length, '个主题');
                return response.data;

            } catch (error) {
                lastError = error;
                console.warn(`获取主题列表失败，尝试 ${attempt}/${retryCount}:`, error.message);

                // 如果是最后一次尝试，直接抛出错误
                if (attempt === retryCount) {
                    break;
                }

                // 如果是网络超时错误，等待后重试
                if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' ||
                    (error.response && error.response.status >= 500)) {
                    const waitTime = attempt * 1000; // 1s, 2s, 3s
                    console.log(`等待 ${waitTime}ms 后重试...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                } else {
                    // 非网络错误，直接抛出
                    break;
                }
            }
        }

        console.error('获取主题列表最终失败:', lastError.message);
        throw lastError;
    }
    
    // 创建主题
    async createTheme(themeData) {
        try {
            const response = await this.client.post('/api/themes', themeData);
            return response.data;
        } catch (error) {
            console.error('创建主题失败:', error);
            throw error;
        }
    }
    
    // 更新主题
    async updateTheme(themeId, themeData) {
        try {
            const response = await this.client.put(`/api/themes/${themeId}`, themeData);
            return response.data;
        } catch (error) {
            console.error('更新主题失败:', error);
            throw error;
        }
    }
    
    // 删除主题
    async deleteTheme(themeId) {
        try {
            const response = await this.client.delete(`/api/themes/${themeId}`);
            return response.data;
        } catch (error) {
            console.error('删除主题失败:', error);
            throw error;
        }
    }
    
    // =================
    // 文件上传API
    // =================
    
    // 上传图片
    // 上传图片
    async uploadImage(imagePath) {
        try {
            console.log('开始上传图片:', imagePath);

            if (!fs.existsSync(imagePath)) {
                throw new Error(`截图失败，未找到图片文件: ${imagePath}`);
            }

            const stats = fs.statSync(imagePath);
            if (stats.size === 0) {
                throw new Error('截图文件为空，无法上传');
            }

            console.log('图片文件验证通过 - 路径:', imagePath, '大小:', stats.size, 'bytes');

            const filename = path.basename(imagePath);
            const fileStream = fs.createReadStream(imagePath);
            const formData = new FormData();
            formData.append('image', fileStream, filename);

            const response = await this.client.post('/api/upload', formData, {
                headers: {
                    ...formData.getHeaders()
                },
                timeout: this.timeout,
                maxContentLength: 50 * 1024 * 1024,
                maxBodyLength: 50 * 1024 * 1024
            });

            const data = response.data || {};
            if (!data.url) {
                throw new Error('服务器未返回图片地址');
            }

            const serverBase = this.serverUrl.replace(/\/$/, '');
            const normalizedPath = data.url.startsWith('/') ? data.url : `/${data.url}`;
            const resolvedUrl = data.url.startsWith('http') ? data.url : `${serverBase}${normalizedPath}`;

            console.log('图片上传成功:', resolvedUrl);

            return {
                success: true,
                url: resolvedUrl,
                filename: data.filename || filename,
                path: data.path || resolvedUrl,
                localOnly: false,
                data
            };

        } catch (error) {
            console.error('上传图片失败:', error);
            return {
                success: false,
                url: `file://${imagePath}`,
                path: imagePath,
                localOnly: true,
                error: error.message || '上传失败'
            };
        }
    }

    
    // 上传文件
    async uploadFile(filePath, targetDir = '') {
        try {
            console.log('上传文件:', filePath);
            
            if (!fs.existsSync(filePath)) {
                throw new Error('文件不存在');
            }
            
            const formData = new FormData();
            const filename = path.basename(filePath);
            const fileStream = fs.createReadStream(filePath);
            
            formData.append('file', fileStream, filename);
            if (targetDir) {
                formData.append('targetDir', targetDir);
            }
            
            const response = await axios.post(`${this.serverUrl}/api/upload`, formData, {
                headers: {
                    ...formData.getHeaders(),
                    'User-Agent': 'Smart Note Collector Windows Client/1.0.0'
                },
                timeout: this.timeout,
                maxContentLength: 100 * 1024 * 1024, // 100MB
                maxBodyLength: 100 * 1024 * 1024
            });
            
            console.log('文件上传成功:', response.data);
            return response.data;
        } catch (error) {
            console.error('上传文件失败:', error);
            throw error;
        }
    }
    
    // =================
    // 导入导出API
    // =================
    
    // 导入URL内容
    async importFromUrl(url) {
        try {
            console.log('从URL导入内容:', url);
            
            const response = await this.client.post('/api/import/url', {
                url: url
            });
            
            return response.data;
        } catch (error) {
            console.error('从URL导入失败:', error);
            throw error;
        }
    }
    
    // 导出笔记
    async exportNotes(format = 'json', options = {}) {
        try {
            console.log('导出笔记，格式:', format);
            
            const response = await this.client.get(`/api/export/${format}`, {
                params: options,
                responseType: 'blob'
            });
            
            return response.data;
        } catch (error) {
            console.error('导出笔记失败:', error);
            throw error;
        }
    }
    
    // 批量导出笔记
    async exportCustomNotes(noteIds, format = 'json') {
        try {
            console.log('批量导出笔记:', noteIds.length, '条');
            
            const response = await this.client.post(`/api/export/custom/${format}`, {
                noteIds: noteIds
            }, {
                responseType: 'blob'
            });
            
            return response.data;
        } catch (error) {
            console.error('批量导出笔记失败:', error);
            throw error;
        }
    }
    
    // =================
    // 爬虫API（如果服务器支持）
    // =================
    
    // 爬取网页内容
    async crawlWebpage(url, options = {}) {
        try {
            console.log('请求服务器爬取网页:', url);
            
            const response = await this.client.post('/api/crawl-content', {
                url: url,
                options: {
                    extractText: true,
                    extractImages: true,
                    extractLinks: true,
                    maxDepth: 1,
                    ...options
                }
            });
            
            return response.data;
        } catch (error) {
            console.error('服务器爬取网页失败:', error);
            // 如果服务器不支持爬虫功能，返回null而不是抛出错误
            if (error.message.includes('404')) {
                console.log('服务器不支持爬虫功能，将使用本地爬虫');
                return null;
            }
            throw error;
        }
    }
    
    // =================
    // AI预设API
    // =================
    
    // 获取AI预设
    async getAiPresets() {
        try {
            const response = await this.client.get('/api/ai-presets');
            return response.data;
        } catch (error) {
            console.error('获取AI预设失败:', error);
            throw error;
        }
    }
    
    // 创建AI预设
    async createAiPreset(presetData) {
        try {
            const response = await this.client.post('/api/ai-presets', presetData);
            return response.data;
        } catch (error) {
            console.error('创建AI预设失败:', error);
            throw error;
        }
    }
    
    // 设置默认AI预设
    async setDefaultAiPreset(presetId) {
        try {
            const response = await this.client.put(`/api/ai-presets/${presetId}/default`);
            return response.data;
        } catch (error) {
            console.error('设置默认AI预设失败:', error);
            throw error;
        }
    }
    
    // =================
    // 统计API
    // =================
    
    // 获取统计信息
    async getStatistics() {
        try {
            const response = await this.client.get('/api/statistics');
            return response.data;
        } catch (error) {
            console.error('获取统计信息失败:', error);
            throw error;
        }
    }
    
    // =================
    // 实用方法
    // =================
    
    // 检查服务器功能支持
    async checkServerFeatures() {
        try {
            const features = {
                crawling: false,
                imageUpload: false,
                aiPresets: false,
                export: false
            };
            
            // 检查爬虫功能
            try {
                await this.client.get('/api/crawl-content');
                features.crawling = true;
            } catch (error) {
                // 忽略错误
            }
            
            // 检查上传功能
            try {
                await this.client.get('/api/upload');
                features.imageUpload = true;
            } catch (error) {
                // 忽略错误
            }
            
            // 检查AI预设功能
            try {
                await this.client.get('/api/ai-presets');
                features.aiPresets = true;
            } catch (error) {
                // 忽略错误
            }
            
            // 检查导出功能
            try {
                await this.client.get('/api/export/json');
                features.export = true;
            } catch (error) {
                // 忽略错误
            }
            
            return features;
        } catch (error) {
            console.error('检查服务器功能失败:', error);
            return {
                crawling: false,
                imageUpload: false,
                aiPresets: false,
                export: false
            };
        }
    }
    
    // 获取服务器信息
    async getServerInfo() {
        try {
            const response = await this.client.get('/api/health');
            return {
                serverUrl: this.serverUrl,
                connected: true,
                version: response.data?.version || 'unknown',
                status: response.data?.status || 'unknown'
            };
        } catch (error) {
            return {
                serverUrl: this.serverUrl,
                connected: false,
                error: error.message
            };
        }
    }
    
    // 销毁客户端
    destroy() {
        console.log('API客户端已销毁');
    }
}

module.exports = ApiClient;