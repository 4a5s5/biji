// API管理模块
class API {
    constructor() {
        this.baseURL = window.location.origin;
        this.apiURL = `${this.baseURL}/api`;
    }

    // 通用请求方法
    async request(endpoint, options = {}) {
        const url = `${this.apiURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            
            return await response.text();
        } catch (error) {
            console.error('API Request Error:', error);
            throw error;
        }
    }

    // GET请求
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url, { method: 'GET' });
    }

    // POST请求
    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // PUT请求
    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // DELETE请求
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    // 文件上传请求
    async upload(endpoint, formData) {
        const url = `${this.apiURL}${endpoint}`;
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Upload Error:', error);
            throw error;
        }
    }

    // 笔记相关API
    notes = {
        // 获取所有笔记
        getAll: (params = {}) => this.get('/notes', params),
        
        // 获取单个笔记
        getById: (id) => this.get(`/notes/${id}`),
        
        // 创建笔记
        create: (data) => {
            if (data instanceof FormData) {
                return this.upload('/notes', data);
            }
            return this.post('/notes', data);
        },
        
        // 更新笔记
        update: (id, data) => {
            if (data instanceof FormData) {
                return this.upload(`/notes/${id}`, data);
            }
            return this.put(`/notes/${id}`, data);
        },
        
        // 删除笔记
        delete: (id) => this.delete(`/notes/${id}`)
    };

    // 主题相关API
    themes = {
        // 获取所有主题
        getAll: () => this.get('/themes'),
        
        // 获取单个主题
        getById: (id) => this.get(`/themes/${id}`),
        
        // 创建主题
        create: (data) => this.post('/themes', data),
        
        // 更新主题
        update: (id, data) => this.put(`/themes/${id}`, data),
        
        // 删除主题
        delete: (id) => this.delete(`/themes/${id}`),
        
        // 获取主题统计
        getStats: (id) => this.get(`/themes/${id}/stats`)
    };

    // AI预设相关API
    aiPresets = {
        // 获取所有预设
        getAll: () => this.get('/ai-presets'),
        
        // 获取默认预设
        getDefault: () => this.get('/ai-presets/default'),
        
        // 获取单个预设
        getById: (id) => this.get(`/ai-presets/${id}`),
        
        // 创建预设
        create: (data) => this.post('/ai-presets', data),
        
        // 更新预设
        update: (id, data) => this.put(`/ai-presets/${id}`, data),
        
        // 删除预设
        delete: (id) => this.delete(`/ai-presets/${id}`),
        
        // 设置默认预设
        setDefault: (id) => this.put(`/ai-presets/${id}/default`, {}),
        
        // 清除默认预设
        clearDefault: () => this.delete('/ai-presets/default')
    };

    // 健康检查
    async healthCheck() {
        try {
            return await this.get('/health');
        } catch (error) {
            console.error('Health check failed:', error);
            return { status: 'error', error: error.message };
        }
    }
}

// 创建全局API实例
window.api = new API();

// 导出API类（如果使用模块系统）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
}
