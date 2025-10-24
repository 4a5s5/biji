// Offscreen document for image processing

// 监听来自background script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Offscreen received message:', request.action);
  
  if (request.action === 'cropImage') {
    cropImage(request.dataUrl, request.area)
      .then(result => {
        console.log('Crop successful');
        sendResponse({ success: true, dataUrl: result });
      })
      .catch(error => {
        console.error('Crop failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // 保持消息通道开放
  }
});

// 裁剪图片函数
function cropImage(dataUrl, area) {
  return new Promise((resolve, reject) => {
    console.log('Starting crop with area:', area);
    const img = new Image();
    
    img.onload = () => {
      const canvas = document.getElementById('canvas');
      
      // 获取设备像素比
      const devicePixelRatio = window.devicePixelRatio || 1;
      console.log('Device pixel ratio:', devicePixelRatio);
      
      // 使用area的实际属性名，并考虑设备像素比
      // 优先使用viewportLeft/viewportTop，因为这些是相对于视口的坐标
      const x = (area.viewportLeft || area.left || area.x || 0) * devicePixelRatio;
      const y = (area.viewportTop || area.top || area.y || 0) * devicePixelRatio;
      const width = area.width * devicePixelRatio;
      const height = area.height * devicePixelRatio;
      
      console.log('Adjusted crop area:', { x, y, width, height });
      console.log('Image dimensions:', { width: img.width, height: img.height });
      
      // 验证裁剪区域是否有效
      if (width <= 0 || height <= 0) {
        reject(new Error('Invalid crop area: width or height is zero or negative'));
        return;
      }
      
      if (x < 0 || y < 0 || x + width > img.width || y + height > img.height) {
        console.warn('Crop area exceeds image bounds, adjusting...');
        // 调整裁剪区域以适应图片边界
        const adjustedX = Math.max(0, Math.min(x, img.width - 1));
        const adjustedY = Math.max(0, Math.min(y, img.height - 1));
        const adjustedWidth = Math.min(width, img.width - adjustedX);
        const adjustedHeight = Math.min(height, img.height - adjustedY);
        
        console.log('Adjusted to fit bounds:', { 
          x: adjustedX, y: adjustedY, 
          width: adjustedWidth, height: adjustedHeight 
        });
        
        // 更新裁剪参数
        x = adjustedX;
        y = adjustedY;
        width = adjustedWidth;
        height = adjustedHeight;
      }
      
      // 设置画布大小为原始尺寸（不乘以设备像素比）
      canvas.width = area.width;
      canvas.height = area.height;
      
      const ctx = canvas.getContext('2d');
      
      // 清除画布
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // 绘制裁剪后的图片
      ctx.drawImage(
        img,
        x, y, width, height,                        // 源图片的裁剪区域（考虑设备像素比）
        0, 0, area.width, area.height              // 目标画布的绘制区域（原始尺寸）
      );
      
      // 转换为data URL
      const croppedDataUrl = canvas.toDataURL('image/png', 0.9);
      console.log('Crop complete, dataUrl length:', croppedDataUrl.length);
      resolve(croppedDataUrl);
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = dataUrl;
  });
}