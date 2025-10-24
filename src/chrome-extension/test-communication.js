// 测试通信脚本
console.log('Test communication script loaded');

// 简单的测试函数
function testCommunication() {
  console.log('Testing communication...');
  
  // 创建一个简单的测试对话框
  const testDialog = document.createElement('div');
  testDialog.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10000;
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    font-family: Arial, sans-serif;
  `;
  
  testDialog.innerHTML = `
    <h3>通信测试成功！</h3>
    <p>Background script 成功与 Content script 通信</p>
    <button id="close-test">关闭</button>
  `;
  
  document.body.appendChild(testDialog);
  
  document.getElementById('close-test').addEventListener('click', () => {
    document.body.removeChild(testDialog);
  });
  
  // 3秒后自动关闭
  setTimeout(() => {
    if (testDialog.parentNode) {
      document.body.removeChild(testDialog);
    }
  }, 3000);
}

// 监听消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Test script received message:', request);
  
  if (request.action === 'test') {
    testCommunication();
    sendResponse({ success: true, message: 'Test dialog shown' });
  }
  
  if (request.action === 'ping') {
    console.log('Ping received, responding...');
    sendResponse({ status: 'ready' });
  }
});
