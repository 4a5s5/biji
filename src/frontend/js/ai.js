// AI分析功能管理器
class AIManager {
    constructor() {
        this.config = {
            apiUrl: '',
            apiKey: '',
            selectedModel: '',
            models: [],
            maxTokens: 65536,
            presets: [],
            defaultPreset: '',
            enableStreamOutput: false
        };
        this.chatHistory = [];
        this.selectedNotes = [];
        this.chatHistoryStorage = []; // 历史对话存储
        this.isInitialized = false;
        this.init();
    }

    // 初始化AI管理器
    async init() {
        try {
            await this.loadConfig();
            this.setupEventListeners();
            this.isInitialized = true;
            console.log('AI管理器初始化完成');
            
            // 确保全局变量可用
            if (typeof window !== 'undefined') {
                window.aiManager = this;
            }
        } catch (error) {
            console.error('AI管理器初始化失败:', error);
            this.isInitialized = false;
        }
    }

    // 加载配置
    async loadConfig() {
        try {
            // 从localStorage加载本地配置（不包括预设）
            const localConfig = localStorage.getItem('aiConfig');
            if (localConfig) {
                const parsed = JSON.parse(localConfig);
                // 只加载非预设相关的配置
                const { presets, defaultPreset, ...otherConfig } = parsed;
                this.config = { ...this.config, ...otherConfig };
            }

            // 从localStorage加载对话历史
            const chatHistory = localStorage.getItem('aiChatHistory');
            if (chatHistory) {
                this.chatHistoryStorage = JSON.parse(chatHistory);
            }

            // 先尝试迁移本地预设到数据库
            await this.migrateLocalPresetsToDatabase();
            
            // 从数据库加载预设
            await this.loadPresetsFromDatabase();
            
            // 从数据库加载默认预设
            await this.loadDefaultPresetFromDatabase();
        } catch (error) {
            console.error('加载AI配置失败:', error);
        }
    }

    // 保存AI配置
    async saveConfig() {
        try {
            // 只保存本地配置（API密钥等敏感信息），不保存预设
            const localConfig = {
                apiUrl: this.config.apiUrl,
                apiKey: this.config.apiKey,
                selectedModel: this.config.selectedModel,
                maxTokens: this.config.maxTokens,
                models: this.config.models,
                enableStreamOutput: this.config.enableStreamOutput
                // 注意：不保存 presets 和 defaultPreset，这些现在存储在数据库中
            };
            localStorage.setItem('aiConfig', JSON.stringify(localConfig));
            ui.showToast('AI配置保存成功', 'success');
        } catch (error) {
            console.error('保存AI配置失败:', error);
            ui.showToast('保存AI配置失败', 'error');
        }
    }

    // 从数据库加载预设
    async loadPresetsFromDatabase() {
        try {
            console.log('正在从数据库加载预设...');
            const data = await window.api.aiPresets.getAll();
            this.config.presets = data.presets || [];
            console.log('从数据库加载的预设:', this.config.presets);
        } catch (error) {
            console.error('从数据库加载预设失败:', error);
            this.config.presets = [];
        }
    }

    // 从数据库加载默认预设
    async loadDefaultPresetFromDatabase() {
        try {
            const data = await window.api.aiPresets.getDefault();
            this.config.defaultPreset = data.defaultPreset ? data.defaultPreset.id : '';
        } catch (error) {
            console.error('从数据库加载默认预设失败:', error);
        }
    }

    // 迁移本地预设到数据库
    async migrateLocalPresetsToDatabase() {
        try {
            // 检查本地存储中是否有预设需要迁移
            const localConfig = localStorage.getItem('aiConfig');
            if (localConfig) {
                const parsed = JSON.parse(localConfig);
                if (parsed.presets && parsed.presets.length > 0) {
                    console.log('发现本地预设，开始迁移到数据库...', parsed.presets);
                    
                    // 检查数据库中是否已有预设
                    try {
                        const data = await window.api.aiPresets.getAll();
                        if (!data.presets || data.presets.length === 0) {
                            // 数据库中没有预设，进行迁移
                            for (const preset of parsed.presets) {
                                await this.savePresetToDatabase(preset);
                            }
                            
                            // 迁移默认预设设置
                            if (parsed.defaultPreset) {
                                await this.setDefaultPresetInDatabase(parsed.defaultPreset);
                            }
                            
                            console.log('预设迁移完成，清除本地预设');
                            // 清除本地存储中的预设数据
                            delete parsed.presets;
                            delete parsed.defaultPreset;
                            localStorage.setItem('aiConfig', JSON.stringify(parsed));
                        } else {
                            console.log('数据库中已有预设，跳过迁移');
                        }
                    } catch (dbError) {
                        console.error('检查数据库预设失败:', dbError);
                    }
                }
            }
        } catch (error) {
            console.error('迁移本地预设失败:', error);
        }
    }

    // 保存预设到数据库
    async savePresetToDatabase(preset) {
        try {
            const result = await window.api.aiPresets.create({
                name: preset.name,
                prompt: preset.prompt,
                is_default: preset.id === this.config.defaultPreset
            });
            console.log('预设保存成功:', result);
            return result;
        } catch (error) {
            console.error('保存预设到数据库失败:', error);
            throw error;
        }
    }

    // 更新数据库中的预设
    async updatePresetInDatabase(presetId, presetData) {
        try {
            const result = await window.api.aiPresets.update(presetId, presetData);
            return result;
        } catch (error) {
            console.error('更新数据库预设失败:', error);
            throw error;
        }
    }

    // 从数据库删除预设
    async deletePresetFromDatabase(presetId) {
        try {
            const result = await window.api.aiPresets.delete(presetId);
            return result;
        } catch (error) {
            console.error('删除数据库预设失败:', error);
            throw error;
        }
    }

    // 在数据库中设置默认预设
    async setDefaultPresetInDatabase(presetId) {
        try {
            if (presetId) {
                await window.api.aiPresets.setDefault(presetId);
            } else {
                await window.api.aiPresets.clearDefault();
            }
        } catch (error) {
            console.error('设置默认预设失败:', error);
            throw error;
        }
    }

    // 设置事件监听器
    setupEventListeners() {
        // AI分析按钮点击事件
        const aiAnalyzeBtn = document.getElementById('aiAnalyzeBtn');
        if (aiAnalyzeBtn) {
            aiAnalyzeBtn.addEventListener('click', () => this.startAIAnalysis());
        }

        // AI设置模态框事件
        this.setupSettingsModalEvents();
        this.setupChatModalEvents();
        this.setupPresetEditModalEvents();
    }

    // 设置AI设置模态框事件
    setupSettingsModalEvents() {
        // 关闭按钮
        const closeBtn = document.getElementById('closeAiSettingsModal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => ui.hideModal('aiSettingsModal'));
        }

        // 取消按钮
        const cancelBtn = document.getElementById('cancelAiSettingsBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => ui.hideModal('aiSettingsModal'));
        }

        // 保存按钮
        const saveBtn = document.getElementById('saveAiSettingsBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveSettings());
        }

        // 选项卡切换
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => this.switchTab(button.dataset.tab));
        });

        // API密钥显示/隐藏
        const toggleBtn = document.getElementById('toggleApiKeyBtn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleApiKeyVisibility());
        }

        // 获取模型列表
        const fetchModelsBtn = document.getElementById('fetchModelsBtn');
        if (fetchModelsBtn) {
            fetchModelsBtn.addEventListener('click', () => this.fetchModels());
        }

        // 测试连接
        const testBtn = document.getElementById('testAiConnectionBtn');
        if (testBtn) {
            testBtn.addEventListener('click', () => this.testConnection());
        }

        // 添加预设按钮
        const addPresetBtn = document.getElementById('addPresetBtn');
        if (addPresetBtn) {
            addPresetBtn.addEventListener('click', () => this.showPresetEditModal());
        }

        // 默认预设选择
        const defaultPresetSelect = document.getElementById('defaultPresetSelect');
        if (defaultPresetSelect) {
            defaultPresetSelect.addEventListener('change', async (e) => {
                try {
                    await this.setDefaultPresetInDatabase(e.target.value);
                    ui.showToast('默认预设设置成功', 'success');
                } catch (error) {
                    ui.showToast('设置默认预设失败', 'error');
                    console.error('设置默认预设失败:', error);
                }
            });
        }
    }

    // 设置AI对话模态框事件
    setupChatModalEvents() {
        // 关闭按钮
        const closeBtn = document.getElementById('closeAiChatModal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeChatModal());
        }

        const closeChatBtn = document.getElementById('closeChatBtn');
        if (closeChatBtn) {
            closeChatBtn.addEventListener('click', () => this.closeChatModal());
        }

        // 发送消息
        const sendBtn = document.getElementById('sendChatBtn');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendMessage());
        }

        // 输入框回车发送
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        // 模型选择
        const modelSelect = document.getElementById('chatModelSelect');
        if (modelSelect) {
            modelSelect.addEventListener('change', () => this.onModelChange());
        }

        // 预设选择
        const presetSelect = document.getElementById('chatPresetSelect');
        if (presetSelect) {
            presetSelect.addEventListener('change', () => this.applyPreset());
        }

        // 清空对话
        document.getElementById('clearChatBtn').addEventListener('click', () => {
            this.clearChat();
        });

        // 绑定导出对话按钮
        document.getElementById('exportChatBtn').addEventListener('click', () => {
            this.showExportOptions();
        });

        // 显示历史记录
        const showHistoryBtn = document.getElementById('showChatHistoryBtn');
        if (showHistoryBtn) {
            showHistoryBtn.addEventListener('click', () => this.showChatHistory());
        }

        // 保存选中对话
        const saveSelectedBtn = document.getElementById('saveSelectedChatsBtn');
        if (saveSelectedBtn) {
            saveSelectedBtn.addEventListener('click', () => this.saveSelectedChats());
        }
    }

    // 设置预设编辑模态框事件
    setupPresetEditModalEvents() {
        // 关闭按钮
        const closeBtn = document.getElementById('closePresetEditModal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => ui.hideModal('presetEditModal'));
        }

        // 取消按钮
        const cancelBtn = document.getElementById('cancelPresetEditBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => ui.hideModal('presetEditModal'));
        }

        // 保存按钮
        const saveBtn = document.getElementById('savePresetBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.savePreset());
        }
    }

    // 显示AI设置模态框
    async showSettingsModal() {
        // 重新从数据库加载最新的预设数据
        await this.loadPresetsFromDatabase();
        await this.loadDefaultPresetFromDatabase();
        
        this.loadSettingsToForm();
        this.renderPresetsList();
        this.loadDefaultPresetSelect();
        ui.showModal('aiSettingsModal');
    }

    // 加载默认预设选择框
    loadDefaultPresetSelect() {
        const defaultPresetSelect = document.getElementById('defaultPresetSelect');
        if (!defaultPresetSelect) return;

        defaultPresetSelect.innerHTML = '<option value="">无默认预设</option>';
        this.config.presets.forEach(preset => {
            const option = document.createElement('option');
            option.value = preset.id;
            option.textContent = preset.name;
            if (preset.id === this.config.defaultPreset) {
                option.selected = true;
            }
            defaultPresetSelect.appendChild(option);
        });
    }

    // 加载设置到表单
    loadSettingsToForm() {
        const apiUrlInput = document.getElementById('aiApiUrl');
        const apiKeyInput = document.getElementById('aiApiKey');
        const modelSelect = document.getElementById('aiModelSelect');
        const maxTokensInput = document.getElementById('aiMaxTokens');
        const enableStreamOutput = document.getElementById('enableStreamOutput');

        if (apiUrlInput) apiUrlInput.value = this.config.apiUrl || '';
        if (apiKeyInput) apiKeyInput.value = this.config.apiKey || '';
        if (maxTokensInput) maxTokensInput.value = this.config.maxTokens || 65536;
        if (enableStreamOutput) enableStreamOutput.checked = this.config.enableStreamOutput || false;
        
        if (modelSelect) {
            modelSelect.innerHTML = '<option value="">请先获取模型列表</option>';
            this.config.models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.name || model.id;
                if (model.id === this.config.selectedModel) {
                    option.selected = true;
                }
                modelSelect.appendChild(option);
            });
        }
    }

    // 切换选项卡
    switchTab(tabName) {
        // 切换按钮状态
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // 切换内容
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName + 'Tab').classList.add('active');
    }

    // 切换API密钥可见性
    toggleApiKeyVisibility() {
        const apiKeyInput = document.getElementById('aiApiKey');
        const toggleBtn = document.getElementById('toggleApiKeyBtn');
        
        if (apiKeyInput && toggleBtn) {
            const isPassword = apiKeyInput.type === 'password';
            apiKeyInput.type = isPassword ? 'text' : 'password';
            toggleBtn.innerHTML = isPassword ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
        }
    }

    // 获取模型列表
    async fetchModels() {
        const apiUrl = document.getElementById('aiApiUrl').value.trim();
        const apiKey = document.getElementById('aiApiKey').value.trim();

        if (!apiUrl || !apiKey) {
            ui.showToast('请先填写API地址和密钥', 'warning');
            return;
        }

        try {
            ui.showLoading('获取模型列表中...');
            
            // 构建模型列表API URL
            const modelsUrl = apiUrl.replace('/chat/completions', '/models');
            
            const response = await fetch(modelsUrl, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.config.models = data.data || [];
            
            // 更新模型选择下拉框
            const modelSelect = document.getElementById('aiModelSelect');
            modelSelect.innerHTML = '<option value="">选择模型...</option>';
            
            this.config.models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.id;
                modelSelect.appendChild(option);
            });

            ui.showToast(`成功获取 ${this.config.models.length} 个模型`, 'success');
            
        } catch (error) {
            console.error('获取模型列表失败:', error);
            ui.showToast('获取模型列表失败: ' + error.message, 'error');
        } finally {
            ui.hideLoading();
        }
    }

    // 测试连接
    async testConnection() {
        const apiUrl = document.getElementById('aiApiUrl').value.trim();
        const apiKey = document.getElementById('aiApiKey').value.trim();
        const selectedModel = document.getElementById('aiModelSelect').value;

        if (!apiUrl || !apiKey || !selectedModel) {
            ui.showToast('请填写完整的API配置信息', 'warning');
            return;
        }

        try {
            ui.showLoading('测试连接中...');
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: selectedModel,
                    messages: [
                        { role: 'user', content: '你好，这是一个连接测试。' }
                    ],
                    max_tokens: 10
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            ui.showToast('连接测试成功！', 'success');
            
        } catch (error) {
            console.error('连接测试失败:', error);
            ui.showToast('连接测试失败: ' + error.message, 'error');
        } finally {
            ui.hideLoading();
        }
    }

    // 保存设置
    async saveSettings() {
        const apiUrl = document.getElementById('aiApiUrl').value.trim();
        const apiKey = document.getElementById('aiApiKey').value.trim();
        const selectedModel = document.getElementById('aiModelSelect').value;
        const maxTokens = parseInt(document.getElementById('aiMaxTokens').value) || 65536;
        const enableStreamOutput = document.getElementById('enableStreamOutput').checked;
        const defaultPresetSelect = document.getElementById('defaultPresetSelect');
        const newDefaultPreset = defaultPresetSelect ? defaultPresetSelect.value : '';

        // 更新本地配置
        this.config.apiUrl = apiUrl;
        this.config.apiKey = apiKey;
        this.config.selectedModel = selectedModel;
        this.config.maxTokens = maxTokens;
        this.config.enableStreamOutput = enableStreamOutput;

        // 如果默认预设发生变化，更新数据库
        if (newDefaultPreset !== this.config.defaultPreset) {
            try {
                if (newDefaultPreset) {
                    await this.setDefaultPresetInDatabase(newDefaultPreset);
                } else {
                    await this.setDefaultPresetInDatabase('');
                }
                this.config.defaultPreset = newDefaultPreset;
                console.log('默认预设已更新:', newDefaultPreset);
            } catch (error) {
                console.error('更新默认预设失败:', error);
                ui.showToast('更新默认预设失败', 'error');
                return;
            }
        }

        this.saveConfig();
        
        // 重新加载预设数据以确保界面同步
        await this.loadPresetsFromDatabase();
        await this.loadDefaultPresetFromDatabase();
        
        // 更新AI对话框中的预设选择
        this.loadPresetsToSelect();
        
        ui.showToast('设置保存成功', 'success');
        ui.hideModal('aiSettingsModal');
    }

    // 渲染预设列表
    renderPresetsList() {
        const presetsList = document.getElementById('presetsList');
        if (!presetsList) return;

        presetsList.innerHTML = '';
        
        this.config.presets.forEach(preset => {
            const presetItem = document.createElement('div');
            presetItem.className = 'preset-item';
            presetItem.innerHTML = `
                <div class="preset-info">
                    <h5>${preset.name}</h5>
                    <p>${preset.prompt.substring(0, 100)}${preset.prompt.length > 100 ? '...' : ''}</p>
                </div>
                <div class="preset-actions">
                    <button class="btn btn-sm btn-outline-primary" onclick="aiManager.editPreset('${preset.id}')">
                        <i class="fas fa-edit"></i>
                        编辑
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="aiManager.deletePreset('${preset.id}')">
                        <i class="fas fa-trash"></i>
                        删除
                    </button>
                </div>
            `;
            presetsList.appendChild(presetItem);
        });
        
        // 更新默认预设选择框
        this.loadDefaultPresetSelect();
    }

    // 显示预设编辑模态框
    showPresetEditModal(presetId = null) {
        const modal = document.getElementById('presetEditModal');
        const title = document.getElementById('presetEditTitle');
        const nameInput = document.getElementById('presetName');
        const promptInput = document.getElementById('presetPrompt');

        if (presetId) {
            const preset = this.config.presets.find(p => p.id === presetId);
            if (preset) {
                title.textContent = '编辑预设';
                nameInput.value = preset.name;
                promptInput.value = preset.prompt;
                modal.dataset.editingId = presetId;
            }
        } else {
            title.textContent = '添加预设';
            nameInput.value = '';
            promptInput.value = '';
            delete modal.dataset.editingId;
        }

        ui.showModal('presetEditModal');
    }

    // 编辑预设
    editPreset(presetId) {
        this.showPresetEditModal(presetId);
    }

    // 删除预设
    async deletePreset(presetId) {
        if (!confirm('确定要删除这个预设吗？')) {
            return;
        }

        try {
            await this.deletePresetFromDatabase(presetId);
            
            // 重新加载预设列表和默认预设
            await this.loadPresetsFromDatabase();
            await this.loadDefaultPresetFromDatabase();
            
            // 更新界面显示
            this.renderPresetsList();
            this.loadDefaultPresetSelect();
            this.loadPresetsToSelect();
            
            ui.showToast('预设删除成功', 'success');
        } catch (error) {
            console.error('删除预设失败:', error);
            ui.showToast('删除预设失败', 'error');
        }
    }

    // 保存预设
    async savePreset() {
        const modal = document.getElementById('presetEditModal');
        const nameInput = document.getElementById('presetName');
        const promptInput = document.getElementById('presetPrompt');

        const name = nameInput.value.trim();
        const prompt = promptInput.value.trim();

        if (!name || !prompt) {
            ui.showToast('请填写预设名称和内容', 'warning');
            return;
        }

        const editingId = modal.dataset.editingId;
        
        try {
            if (editingId) {
                // 编辑现有预设
                await this.updatePresetInDatabase(editingId, {
                    name: name,
                    prompt: prompt,
                    is_default: false
                });
                ui.showToast('预设更新成功', 'success');
            } else {
                // 添加新预设
                const newPreset = {
                    id: Date.now().toString(),
                    name: name,
                    prompt: prompt
                };
                await this.savePresetToDatabase(newPreset);
                ui.showToast('预设创建成功', 'success');
            }

            // 重新加载预设列表和默认预设
            await this.loadPresetsFromDatabase();
            await this.loadDefaultPresetFromDatabase();
            
            // 更新界面显示
            this.renderPresetsList();
            this.loadDefaultPresetSelect();
            this.loadPresetsToSelect();
            
            ui.hideModal('presetEditModal');
        } catch (error) {
            ui.showToast('保存预设失败', 'error');
            console.error('保存预设失败:', error);
        }
    }

    // 开始AI分析
    startAIAnalysis() {
        if (!this.validateConfig()) {
            this.showSettingsModal();
            return;
        }

        // 获取选中的笔记
        this.selectedNotes = this.getSelectedNotes();
        
        if (this.selectedNotes.length === 0) {
            ui.showToast('请先选择要分析的笔记', 'warning');
            return;
        }

        // 显示AI对话界面
        this.showChatModal();
    }

    // 验证AI配置
    validateConfig() {
        return this.config.apiUrl && this.config.apiKey && this.config.selectedModel;
    }

    // 获取选中的笔记
    getSelectedNotes() {
        const notes = [];
        
        if (window.noteManager && window.noteManager.selectedNotes) {
            // 从笔记管理器的selectedNotes Set中获取选中的笔记ID
            window.noteManager.selectedNotes.forEach(noteId => {
                const note = window.noteManager.notes.find(n => n.id === noteId);
                if (note) {
                    notes.push(note);
                }
            });
        }
        
        return notes;
    }

    // 显示AI对话模态框
    async showChatModal() {
        // 重新加载最新的预设数据
        await this.loadPresetsFromDatabase();
        await this.loadDefaultPresetFromDatabase();
        
        // 重置对话状态
        this.resetChatState();
        
        this.loadPresetsToSelect();
        this.loadModelsToSelect();
        this.renderChatMessages();
        ui.showModal('aiChatModal');
        
        // 自动应用默认预设或第一个预设
        const presetSelect = document.getElementById('chatPresetSelect');
        if (presetSelect) {
            const defaultPresetId = this.config.defaultPreset || (this.config.presets.length > 0 ? this.config.presets[0].id : '');
            if (defaultPresetId) {
                presetSelect.value = defaultPresetId;
                this.applyPreset();
            }
        }
        
        // 自动选择当前配置的模型
        const modelSelect = document.getElementById('chatModelSelect');
        if (modelSelect && this.config.selectedModel) {
            modelSelect.value = this.config.selectedModel;
        }
    }

    // 重置对话状态
    resetChatState() {
        this.chatHistory = [];
        this.currentChatId = null; // 重置对话ID
        this.selectedNotes = this.getSelectedNotes(); // 重新获取选中的笔记
        
        // 清空输入框
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.value = '';
        }
    }

    // 关闭对话模态框
    closeChatModal() {
        // 如果有对话历史，保存到历史记录中
        if (this.chatHistory.length > 0) {
            this.saveChatToHistory();
        }
        
        ui.hideModal('aiChatModal');
    }

    // 保存对话到历史记录
    saveChatToHistory() {
        // 生成对话的唯一标识符（基于对话内容的哈希）
        const chatSignature = this.generateChatSignature();
        
        // 检查是否已存在相同的对话
        const existingIndex = this.chatHistoryStorage.findIndex(session => 
            session.signature === chatSignature
        );
        
        const chatSession = {
            id: this.currentChatId || Date.now().toString(),
            signature: chatSignature,
            date: new Date().toISOString(),
            title: this.generateChatTitle(),
            selectedNotes: [...this.selectedNotes],
            chatHistory: [...this.chatHistory]
        };
        
        if (existingIndex !== -1) {
            // 替换已存在的对话
            this.chatHistoryStorage[existingIndex] = chatSession;
        } else {
            // 添加新对话
            this.chatHistoryStorage.unshift(chatSession);
        }
        
        // 限制历史记录数量（保留最近20条）
        if (this.chatHistoryStorage.length > 20) {
            this.chatHistoryStorage = this.chatHistoryStorage.slice(0, 20);
        }
        
        // 保存到localStorage
        localStorage.setItem('aiChatHistory', JSON.stringify(this.chatHistoryStorage));
    }

    // 生成对话签名（用于识别重复对话）
    generateChatSignature() {
        // 基于对话内容生成简单哈希
        const content = this.chatHistory.map(msg => `${msg.role}:${msg.content}`).join('|');
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        return hash.toString();
    }

    // 生成对话标题
    generateChatTitle() {
        if (this.chatHistory.length === 0) return '空对话';
        
        const firstUserMessage = this.chatHistory.find(msg => msg.role === 'user');
        if (firstUserMessage) {
            const title = firstUserMessage.content.substring(0, 30);
            return title.length < firstUserMessage.content.length ? title + '...' : title;
        }
        
        return `对话 - ${new Date().toLocaleDateString()}`;
    }

    // 加载模型到选择框
    loadModelsToSelect() {
        const modelSelect = document.getElementById('chatModelSelect');
        if (!modelSelect) return;

        modelSelect.innerHTML = '<option value="">选择模型...</option>';
        
        if (this.config.models && this.config.models.length > 0) {
            this.config.models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.name || model.id;
                if (model.id === this.config.selectedModel) {
                    option.selected = true;
                }
                modelSelect.appendChild(option);
            });
        }
    }

    // 模型变更处理
    onModelChange() {
        const modelSelect = document.getElementById('chatModelSelect');
        if (!modelSelect) return;

        const selectedModel = modelSelect.value;
        if (selectedModel !== this.config.selectedModel) {
            this.config.selectedModel = selectedModel;
            // 实时保存配置
            this.saveConfig();
            console.log('模型已切换到:', selectedModel);
            ui.showToast(`已切换到模型: ${selectedModel}`, 'success');
        }
    }

    // 改进的Markdown渲染器
    renderMarkdown(text) {
        if (!text) return '';
        
        // 生成唯一ID用于代码块
        const generateCodeId = () => 'code_' + Math.random().toString(36).substr(2, 9);
        
        let html = text
            // 代码块 (```) - 添加复制按钮
            .replace(/```(\w+)?\n?([\s\S]*?)```/g, (match, lang, code) => {
                const codeId = generateCodeId();
                const language = lang || 'text';
                const trimmedCode = code.trim();
                return `<div class="code-block-container">
                    <div class="code-block-actions">
                        <button class="copy-code-btn" onclick="aiManager.copyCodeBlock('${codeId}')" title="复制代码">
                            <i class="fas fa-copy"></i> 复制
                        </button>
                    </div>
                    <pre><code id="${codeId}" class="language-${language}">${this.escapeHtml(trimmedCode)}</code></pre>
                </div>`;
            })
            // 行内代码 (`)
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            // 粗体 (**)
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // 斜体 (*)
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // 标题 (#)
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            // 链接 [text](url)
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
            // 引用块 (>)
            .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
            // 无序列表 (-)
            .replace(/^- (.*$)/gm, '<li>$1</li>')
            // 有序列表 (1.)
            .replace(/^\d+\. (.*$)/gm, '<li>$1</li>');

        // 处理段落和换行
        html = html
            .split('\n\n')
            .map(paragraph => {
                if (paragraph.trim() === '') return '';
                if (paragraph.includes('<h1>') || paragraph.includes('<h2>') || 
                    paragraph.includes('<h3>') || paragraph.includes('<pre>') ||
                    paragraph.includes('<blockquote>') || paragraph.includes('<li>')) {
                    return paragraph;
                }
                return `<p>${paragraph.replace(/\n/g, '<br>')}</p>`;
            })
            .join('\n');

        // 包装列表项
        html = html.replace(/(<li>.*?<\/li>)/gs, (match) => {
            if (!match.includes('<ul>') && !match.includes('<ol>')) {
                return `<ul>${match}</ul>`;
            }
            return match;
        });
        
        return html;
    }

    // HTML转义函数
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }


    // 复制代码块
    async copyCodeBlock(codeId) {
        const codeElement = document.getElementById(codeId);
        if (!codeElement) {
            console.error('找不到代码元素:', codeId);
            return;
        }

        const textToCopy = codeElement.textContent;
        const button = codeElement.closest('.code-block-container')?.querySelector('.copy-code-btn');
        
        try {
            await navigator.clipboard.writeText(textToCopy);
            
            // 更新按钮状态
            if (button) {
                const originalText = button.innerHTML;
                button.innerHTML = '<i class="fas fa-check"></i> 已复制';
                button.classList.add('copied');
                
                setTimeout(() => {
                    button.innerHTML = originalText;
                    button.classList.remove('copied');
                }, 2000);
            }
            
            ui.showToast('代码已复制到剪贴板', 'success');
        } catch (error) {
            console.error('复制失败:', error);
            ui.showToast('复制失败', 'error');
        }
    }

    // 导出单个消息为Markdown文件
    exportMessageAsMarkdown(messageId) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageElement) {
            ui.showToast('找不到消息内容', 'error');
            return;
        }

        const originalContent = messageElement.dataset.originalContent;
        if (!originalContent) {
            ui.showToast('找不到原始内容', 'error');
            return;
        }

        const message = this.chatHistory.find(m => m.id === messageId);
        const role = message?.role === 'user' ? '用户' : 'AI助手';

        // 提取Markdown文本部分
        const markdownContent = this.extractMarkdownBlocks(originalContent);

        // 创建并下载文件
        const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${role}消息_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        ui.showToast('Markdown内容已导出', 'success');
    }

    // 提取Markdown文本块
    extractMarkdownBlocks(content) {
        let result = '';
        
        // 查找所有特殊标记块（如<思维导图>、<主题论点分析>等）
        const blockPattern = /<([^>]+)>([\s\S]*?)(?=<[^>]+>|$)/g;
        let match;
        
        while ((match = blockPattern.exec(content)) !== null) {
            const blockName = match[1];
            const blockContent = match[2].trim();
            
            // 只提取包含实际内容的块
            if (blockContent && blockContent.length > 0) {
                result += `<${blockName}>\n${blockContent}\n\n`;
            }
        }
        
        // 如果没有找到特殊标记块，查找代码块
        if (!result.trim()) {
            const codeBlockPattern = /```[\s\S]*?```/g;
            const codeBlocks = content.match(codeBlockPattern);
            if (codeBlocks) {
                result = codeBlocks.join('\n\n');
            }
        }
        
        // 如果仍然没有内容，返回原始内容
        if (!result.trim()) {
            result = content;
        }
        
        return result.trim();
    }

    // 显示导出选项
    showExportOptions() {
        if (this.chatHistory.length === 0) {
            ui.showToast('没有对话内容可导出', 'warning');
            return;
        }

        // 创建选项菜单
        const existingMenu = document.querySelector('.export-options-menu');
        if (existingMenu) {
            existingMenu.remove();
        }

        const menu = document.createElement('div');
        menu.className = 'export-options-menu';
        menu.style.cssText = `
            position: fixed;
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 2000;
            min-width: 180px;
        `;
        
        menu.innerHTML = `
            <div class="export-option" onclick="aiManager.exportChat('md')" style="padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #eee;">
                <i class="fas fa-markdown"></i> 导出为MD文件
            </div>
            <div class="export-option" onclick="aiManager.exportChat('txt')" style="padding: 12px 16px; cursor: pointer;">
                <i class="fas fa-file-alt"></i> 导出为TXT文件
            </div>
        `;

        // 定位菜单到导出按钮附近
        const exportBtn = document.getElementById('exportChatBtn');
        if (exportBtn) {
            const rect = exportBtn.getBoundingClientRect();
            menu.style.top = (rect.bottom + 5) + 'px';
            menu.style.left = rect.left + 'px';
        }

        document.body.appendChild(menu);

        // 点击外部关闭菜单
        setTimeout(() => {
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target) && !exportBtn.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            });
        }, 100);
    }

    // 导出对话
    exportChat(format) {
        if (this.chatHistory.length === 0) {
            ui.showToast('没有对话内容可导出', 'warning');
            return;
        }

        let content = '';
        const timestamp = new Date().toLocaleString();
        
        if (format === 'md') {
            content = `# AI对话记录\n\n`;
            content += `**导出时间**: ${timestamp}\n\n`;
            
            if (this.selectedNotes.length > 0) {
                content += `## 相关笔记\n\n`;
                this.selectedNotes.forEach(note => {
                    content += `- ${note.title}\n`;
                });
                content += `\n`;
            }

            content += `## 对话内容\n\n`;
            
            this.chatHistory.forEach((message, index) => {
                const role = message.role === 'user' ? '用户' : 'AI助手';
                const msgTimestamp = message.timestamp instanceof Date ? 
                    message.timestamp.toLocaleString() : 
                    new Date(message.timestamp).toLocaleString();
                
                content += `### ${role} (${msgTimestamp})\n\n`;
                content += `${message.content}\n\n`;
                content += `---\n\n`;
            });
        } else {
            content = `AI对话记录\n`;
            content += `导出时间: ${timestamp}\n\n`;
            
            if (this.selectedNotes.length > 0) {
                content += `相关笔记:\n`;
                this.selectedNotes.forEach(note => {
                    content += `- ${note.title}\n`;
                });
                content += `\n`;
            }

            content += `对话内容:\n\n`;
            
            this.chatHistory.forEach((message, index) => {
                const role = message.role === 'user' ? '用户' : 'AI助手';
                const msgTimestamp = message.timestamp instanceof Date ? 
                    message.timestamp.toLocaleString() : 
                    new Date(message.timestamp).toLocaleString();
                
                content += `${role} (${msgTimestamp}):\n`;
                content += `${message.content}\n\n`;
                content += `${'='.repeat(50)}\n\n`;
            });
        }

        // 创建并下载文件
        const mimeType = format === 'md' ? 'text/markdown' : 'text/plain';
        const extension = format === 'md' ? 'md' : 'txt';
        const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AI对话记录_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // 关闭选项菜单
        const menu = document.querySelector('.export-options-menu');
        if (menu) menu.remove();

        const formatText = format === 'md' ? 'Markdown' : 'TXT';
        ui.showToast(`${formatText}文件已导出`, 'success');
    }

    // 显示对话历史记录
    showChatHistory() {
        this.loadChatHistoryFromStorage();
        this.renderChatHistory();
        ui.showModal('chatHistoryModal');
        
        // 绑定历史记录模态框事件
        this.setupChatHistoryModalEvents();
    }

    // 渲染对话历史记录
    renderChatHistory() {
        const historyList = document.getElementById('chatHistoryList');
        if (!historyList) return;

        historyList.innerHTML = '';

        if (this.chatHistoryStorage.length === 0) {
            historyList.innerHTML = '<div class="text-center text-muted">暂无历史记录</div>';
            return;
        }

        this.chatHistoryStorage.forEach(session => {
            const historyItem = document.createElement('div');
            historyItem.className = 'chat-history-item';
            
            const date = new Date(session.date);
            const preview = this.generateHistoryPreview(session.chatHistory);
            
            historyItem.innerHTML = `
                <div class="chat-history-header">
                    <h5 class="chat-history-title">${session.title}</h5>
                    <span class="chat-history-date">${date.toLocaleString()}</span>
                </div>
                <div class="chat-history-info">
                    ${session.selectedNotes.length} 条笔记 • ${session.chatHistory.length} 条对话
                </div>
                <div class="chat-history-preview">${preview}</div>
                <div class="chat-history-actions">
                    <button class="btn btn-sm btn-primary restore-btn" data-session-id="${session.id}">
                        <i class="fas fa-undo"></i> 恢复
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-btn" data-session-id="${session.id}">
                        <i class="fas fa-trash"></i> 删除
                    </button>
                </div>
            `;
            
            // 添加事件监听器
            const restoreBtn = historyItem.querySelector('.restore-btn');
            const deleteBtn = historyItem.querySelector('.delete-btn');
            
            if (restoreBtn) {
                restoreBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    try {
                        this.restoreChatHistory(session.id);
                    } catch (error) {
                        console.error('恢复对话历史错误:', error);
                        ui.showToast('恢复对话失败，请重试', 'error');
                    }
                });
            }
            
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    try {
                        this.deleteChatHistory(session.id);
                    } catch (error) {
                        console.error('删除对话历史错误:', error);
                        ui.showToast('删除对话失败，请重试', 'error');
                    }
                });
            }
            
            historyList.appendChild(historyItem);
        });
    }

    // 生成历史记录预览
    generateHistoryPreview(chatHistory) {
        if (chatHistory.length === 0) return '空对话';
        
        const firstUserMessage = chatHistory.find(msg => msg.role === 'user');
        const firstAiMessage = chatHistory.find(msg => msg.role === 'assistant');
        
        let preview = '';
        if (firstUserMessage) {
            preview += `用户: ${firstUserMessage.content.substring(0, 50)}...`;
        }
        if (firstAiMessage) {
            preview += `\nAI: ${firstAiMessage.content.substring(0, 50)}...`;
        }
        
        return preview || '无内容';
    }

    // 恢复对话历史
    restoreChatHistory(sessionId) {
        try {
            const session = this.chatHistoryStorage.find(s => s.id === sessionId);
            if (!session) {
                ui.showToast('历史记录不存在', 'error');
                return;
            }

            // 设置当前对话ID，用于后续保存时识别
            this.currentChatId = session.id;

            // 恢复对话历史，确保timestamp是Date对象
            this.chatHistory = session.chatHistory.map(message => ({
                ...message,
                timestamp: message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp)
            }));
            this.selectedNotes = [...session.selectedNotes];

            // 关闭历史记录模态框
            ui.hideModal('chatHistoryModal');

            // 重新渲染对话
            this.renderChatMessages();

            ui.showToast('对话历史已恢复', 'success');
        } catch (error) {
            console.error('恢复对话历史失败:', error);
            ui.showToast('恢复对话失败: ' + error.message, 'error');
        }
    }

    // 删除对话历史
    deleteChatHistory(sessionId) {
        if (!confirm('确定要删除这条历史记录吗？')) return;

        this.chatHistoryStorage = this.chatHistoryStorage.filter(s => s.id !== sessionId);
        localStorage.setItem('aiChatHistory', JSON.stringify(this.chatHistoryStorage));
        
        this.renderChatHistory();
        ui.showToast('历史记录已删除', 'success');
    }

    // 清空所有历史记录
    clearAllHistory() {
        if (!confirm('确定要清空所有历史记录吗？此操作不可恢复。')) return;

        this.chatHistoryStorage = [];
        localStorage.removeItem('aiChatHistory');
        
        this.renderChatHistory();
        ui.showToast('所有历史记录已清空', 'success');
    }

    // 设置历史记录模态框事件
    setupChatHistoryModalEvents() {
        const closeBtn = document.getElementById('closeChatHistoryModal');
        const closeBtn2 = document.getElementById('closeChatHistoryModalBtn');
        const clearAllBtn = document.getElementById('clearAllHistoryBtn');

        if (closeBtn) {
            closeBtn.removeEventListener('click', this.closeChatHistoryModal);
            closeBtn.addEventListener('click', () => ui.hideModal('chatHistoryModal'));
        }

        if (closeBtn2) {
            closeBtn2.removeEventListener('click', this.closeChatHistoryModal);
            closeBtn2.addEventListener('click', () => ui.hideModal('chatHistoryModal'));
        }

        if (clearAllBtn) {
            clearAllBtn.removeEventListener('click', this.clearAllHistory);
            clearAllBtn.addEventListener('click', () => this.clearAllHistory());
        }
    }

    // 从存储加载对话历史
    loadChatHistoryFromStorage() {
        try {
            const stored = localStorage.getItem('aiChatHistory');
            if (stored) {
                this.chatHistoryStorage = JSON.parse(stored);
            }
        } catch (error) {
            console.error('加载对话历史失败:', error);
            this.chatHistoryStorage = [];
        }
    }

    // 加载预设到选择框
    loadPresetsToSelect() {
        const presetSelect = document.getElementById('chatPresetSelect');
        if (!presetSelect) return;

        presetSelect.innerHTML = '<option value="">选择预设...</option>';
        this.config.presets.forEach(preset => {
            const option = document.createElement('option');
            option.value = preset.id;
            option.textContent = preset.name;
            presetSelect.appendChild(option);
        });
    }

    // 应用预设
    applyPreset() {
        const presetSelect = document.getElementById('chatPresetSelect');
        const chatInput = document.getElementById('chatInput');
        
        if (!presetSelect || !chatInput) return;

        const presetId = presetSelect.value;
        if (!presetId) {
            chatInput.value = '';
            return;
        }

        const preset = this.config.presets.find(p => p.id === presetId);
        if (!preset) return;

        // 替换{{TEXTS}}变量
        const notesContent = this.extractNotesContent();
        const prompt = preset.prompt.replace('{{TEXTS}}', notesContent);
        
        chatInput.value = prompt;
    }

    // 提取笔记内容
    extractNotesContent() {
        let content = '';
        this.selectedNotes.forEach((note, index) => {
            content += `段落${index + 1}：\n${note.content}\n\n`;
        });
        return content.trim();
    }

    // 发送消息
    async sendMessage() {
        const chatInput = document.getElementById('chatInput');
        if (!chatInput) return;

        const message = chatInput.value.trim();
        if (!message) return;

        // 添加用户消息到历史
        this.chatHistory.push({
            id: Date.now().toString(),
            role: 'user',
            content: message,
            timestamp: new Date()
        });

        // 清空输入框
        chatInput.value = '';

        // 重新渲染消息
        this.renderChatMessages();

        // 发送到AI
        await this.sendToAI(message);
    }

    // 发送到AI
    async sendToAI(message) {
        try {
            this.showAILoading(true);
            
            // 构建消息历史
            const messages = this.chatHistory.map(msg => ({
                role: msg.role,
                content: msg.content
            }));

            // 根据配置决定是否使用流式输出
            if (this.config.enableStreamOutput) {
                await this.sendToAIStream(messages);
            } else {
                await this.sendToAINonStream(messages);
            }

        } catch (error) {
            console.error('AI请求失败:', error);
            ui.showToast('AI请求失败: ' + error.message, 'error');
        } finally {
            this.showAILoading(false);
        }
    }

    // 非流式输出
    async sendToAINonStream(messages) {
        const response = await fetch(this.config.apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.config.selectedModel,
                messages: messages,
                temperature: 0.7,
                max_tokens: this.config.maxTokens || 65536
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('AI API响应数据:', data);

        // 检查响应结构
        if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
            throw new Error('API响应格式错误：缺少choices数组');
        }

        const choice = data.choices[0];
        if (!choice.message) {
            throw new Error('API响应格式错误：缺少message对象');
        }

        let aiResponse = choice.message.content;
        
        // 处理空内容的情况
        if (!aiResponse || aiResponse.trim() === '') {
            if (choice.finish_reason === 'length') {
                aiResponse = '抱歉，回复内容因为长度限制被截断了。请尝试提出更简洁的问题，或者在设置中增加max_tokens参数。';
            } else {
                aiResponse = '抱歉，AI没有返回有效内容。请重试或检查您的问题。';
            }
            console.warn('AI返回空内容，finish_reason:', choice.finish_reason);
        }

        console.log('AI回复内容:', aiResponse);

        // 添加AI回复到历史
        this.chatHistory.push({
            id: Date.now().toString(),
            role: 'assistant',
            content: aiResponse,
            timestamp: new Date()
        });

        // 重新渲染消息
        this.renderChatMessages();
    }

    // 流式输出
    async sendToAIStream(messages) {
        const response = await fetch(this.config.apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.config.selectedModel,
                messages: messages,
                temperature: 0.7,
                max_tokens: this.config.maxTokens || 65536,
                stream: true
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // 创建AI消息占位符
        const aiMessageId = Date.now().toString();
        const aiMessage = {
            id: aiMessageId,
            role: 'assistant',
            content: '',
            timestamp: new Date()
        };

        this.chatHistory.push(aiMessage);
        this.renderChatMessages();

        // 获取消息元素用于流式更新
        const messageElement = document.querySelector(`[data-message-id="${aiMessageId}"]`);
        const textElement = messageElement?.querySelector('.chat-text');
        
        if (!textElement) {
            throw new Error('无法找到消息元素');
        }

        // 添加流式输出标识
        textElement.classList.add('streaming-message');
        textElement.innerHTML = '<span class="streaming-cursor"></span>';

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.trim() === '') continue;
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(data);
                            const delta = parsed.choices?.[0]?.delta;
                            
                            if (delta?.content) {
                                fullContent += delta.content;
                                
                                // 实时更新显示内容
                                const renderedContent = this.renderMarkdown(fullContent);
                                textElement.innerHTML = renderedContent + '<span class="streaming-cursor"></span>';
                                
                                // 滚动到底部
                                const chatMessages = document.getElementById('chatMessages');
                                if (chatMessages) {
                                    chatMessages.scrollTop = chatMessages.scrollHeight;
                                }
                            }
                        } catch (e) {
                            console.warn('解析流式数据失败:', e, data);
                        }
                    }
                }
            }
        } finally {
            // 移除流式输出标识和光标
            textElement.classList.remove('streaming-message');
            const cursor = textElement.querySelector('.streaming-cursor');
            if (cursor) cursor.remove();
            
            // 更新历史记录中的内容
            aiMessage.content = fullContent || '抱歉，AI没有返回有效内容。';
            
            // 最终渲染
            textElement.innerHTML = this.renderMarkdown(aiMessage.content);
        }
    }

    // 显示/隐藏AI加载状态
    showAILoading(show) {
        const loading = document.getElementById('aiLoading');
        const statusText = document.getElementById('aiStatusText');
        
        if (loading && statusText) {
            if (show) {
                loading.style.display = 'block';
                statusText.textContent = '思考中...';
            } else {
                loading.style.display = 'none';
                statusText.textContent = '准备就绪';
            }
        }
    }

    // 渲染对话消息
    renderChatMessages() {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        chatMessages.innerHTML = '';

        this.chatHistory.forEach(message => {
            const messageElement = this.createMessageElement(message);
            chatMessages.appendChild(messageElement);
        });

        // 滚动到底部
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // 创建消息元素
    createMessageElement(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${message.role}`;
        messageDiv.dataset.messageId = message.id;
        messageDiv.dataset.originalContent = message.content; // 保存原始内容

        const avatar = document.createElement('div');
        avatar.className = `chat-avatar ${message.role}`;
        avatar.textContent = message.role === 'user' ? 'U' : 'AI';

        const content = document.createElement('div');
        content.className = 'chat-content';
        
        const text = document.createElement('div');
        text.className = 'chat-text';
        text.style.position = 'relative';
        
        // 使用Markdown渲染器渲染消息内容
        text.innerHTML = this.renderMarkdown(message.content);
        
        
        const actionsBar = document.createElement('div');
        actionsBar.className = 'chat-actions-bar';
        
        const timestamp = document.createElement('span');
        timestamp.className = 'chat-timestamp';
        // 确保timestamp是Date对象
        const timestampDate = message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp);
        timestamp.textContent = timestampDate.toLocaleTimeString();
        
        const actions = document.createElement('div');
        actions.className = 'chat-message-actions';
        
        // 为AI消息添加导出MD按钮
        const exportButton = message.role === 'assistant' ? 
            `<button onclick="aiManager.exportMessageAsMarkdown('${message.id}')" title="导出MD">
                <i class="fas fa-download"></i>
            </button>` : '';
        
        actions.innerHTML = `
            <button onclick="aiManager.toggleMessageSelection('${message.id}')" title="选择">
                <i class="fas fa-check"></i>
            </button>
            <button onclick="aiManager.copyMessage('${message.id}')" title="复制">
                <i class="fas fa-copy"></i>
            </button>
            ${exportButton}
        `;

        actionsBar.appendChild(timestamp);
        actionsBar.appendChild(actions);
        
        content.appendChild(text);
        content.appendChild(actionsBar);
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);

        return messageDiv;
    }

    // 切换消息选择状态
    toggleMessageSelection(messageId) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            messageElement.classList.toggle('message-selected');
        }
    }

    // 复制消息
    copyMessage(messageId) {
        const message = this.chatHistory.find(m => m.id === messageId);
        if (message) {
            navigator.clipboard.writeText(message.content).then(() => {
                ui.showToast('消息已复制到剪贴板', 'success');
            });
        }
    }

    // 清空对话
    clearChat() {
        if (confirm('确定要清空所有对话吗？')) {
            this.chatHistory = [];
            this.renderChatMessages();
            
            // 清空输入框并重新应用预设
            const chatInput = document.getElementById('chatInput');
            if (chatInput) {
                chatInput.value = '';
            }
            
            // 重新应用当前选中的预设
            this.applyPreset();
        }
    }

    // 保存选中的对话
    saveSelectedChats() {
        const selectedMessages = document.querySelectorAll('.message-selected');
        if (selectedMessages.length === 0) {
            ui.showToast('请先选择要保存的对话', 'warning');
            return;
        }

        // 收集选中的消息
        const selectedContent = [];
        selectedMessages.forEach(element => {
            const messageId = element.dataset.messageId;
            const message = this.chatHistory.find(m => m.id === messageId);
            if (message) {
                selectedContent.push({
                    role: message.role,
                    content: message.content,
                    timestamp: message.timestamp
                });
            }
        });

        // 显示保存对话的模态框
        this.showSaveChatModal(selectedContent);
    }

    // 显示保存对话模态框
    showSaveChatModal(content) {
        // 这里可以复用现有的笔记创建模态框
        // 或者创建一个专门的保存对话模态框
        if (window.noteManager) {
            const chatContent = content.map(msg => 
                `**${msg.role === 'user' ? '用户' : 'AI'}** (${msg.timestamp.toLocaleString()}):\n${msg.content}`
            ).join('\n\n---\n\n');

            // 打开新建笔记模态框并预填内容
            window.noteManager.showNoteModal();
            
            setTimeout(() => {
                const titleInput = document.getElementById('noteTitle');
                const contentInput = document.getElementById('noteContent');
                
                if (titleInput) {
                    titleInput.value = `AI分析对话 - ${new Date().toLocaleDateString()}`;
                }
                
                if (contentInput) {
                    contentInput.value = chatContent;
                }
            }, 100);
        }
    }
}

// 创建全局AI管理器实例
window.aiManager = new AIManager();
