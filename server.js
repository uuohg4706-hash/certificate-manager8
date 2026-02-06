// خادم Node.js بسيط لحفظ بيانات الشهادات
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('.'));

// مجلد لحفظ البيانات
const dataDir = path.join(__dirname, 'certificates-data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// حفظ شهادة جديدة
app.post('/api/certificates/save', (req, res) => {
  try {
    const { registrationNumber, studentName, studentCategory, certification, image } = req.body;
    
    if (!registrationNumber || !studentName || !studentCategory) {
      return res.status(400).json({ error: 'بيانات ناقصة - يجب تحديد رقم القيد والاسم والفئة' });
    }
    
    // إنشاء معرف فريد
    const certId = Date.now().toString();
    const fileName = `${certId}_${registrationNumber}_${studentName.replace(/\s+/g, '_')}`;
    
    // حفظ البيانات في ملف JSON
    const certData = {
      id: certId,
      registrationNumber,
      studentName,
      studentCategory,
      ...certification,
      savedAt: new Date().toISOString(),
      imagePath: image ? `${fileName}.png` : null
    };
    
    // حفظ الصورة إذا كانت موجودة
    if (image) {
      const base64Data = image.replace(/^data:image\/png;base64,/, '');
      fs.writeFileSync(
        path.join(dataDir, `${fileName}.png`),
        Buffer.from(base64Data, 'base64')
      );
    }
    
    // حفظ بيانات JSON
    fs.writeFileSync(
      path.join(dataDir, `${fileName}.json`),
      JSON.stringify(certData, null, 2)
    );
    
    res.json({
      success: true,
      message: 'تم حفظ الشهادة بنجاح',
      id: certId,
      fileName
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'خطأ في حفظ الشهادة' });
  }
});

// جلب قائمة الشهادات
app.get('/api/certificates/list', (req, res) => {
  try {
    const files = fs.readdirSync(dataDir);
    const certificates = [];
    
    files.forEach(file => {
      if (file.endsWith('.json')) {
        const data = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
        certificates.push(data);
      }
    });
    
    res.json(certificates);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'خطأ في جلب الشهادات' });
  }
});

// جلب شهادة محددة
app.get('/api/certificates/:id', (req, res) => {
  try {
    const files = fs.readdirSync(dataDir);
    for (const file of files) {
      if (file.startsWith(req.params.id) && file.endsWith('.json')) {
        const data = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
        res.json(data);
        return;
      }
    }
    res.status(404).json({ error: 'الشهادة غير موجودة' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'خطأ في جلب الشهادة' });
  }
});

// تحميل صورة الشهادة
app.get('/api/certificates/image/:fileName', (req, res) => {
  try {
    let fileName = req.params.fileName;
    
    // إزالة .png من آخر الملف إذا كانت موجودة
    if (!fileName.endsWith('.png')) {
      fileName = `${fileName}.png`;
    }
    
    let filePath = path.join(dataDir, fileName);
    
    // إذا لم تكن الصورة موجودة، حاول البحث عن ملف يبدأ بنفس الرقم
    if (!fs.existsSync(filePath)) {
      const files = fs.readdirSync(dataDir);
      const searchPattern = req.params.fileName.split('_')[0]; // الجزء الأول من اسم الملف (المعرف)
      const foundFile = files.find(f => f.startsWith(searchPattern) && f.endsWith('.png'));
      
      if (foundFile) {
        filePath = path.join(dataDir, foundFile);
      }
    }
    
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'image/png');
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: 'الصورة غير موجودة' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'خطأ في تحميل الصورة' });
  }
});

// البحث عن شهادة برقم القيد
app.get('/api/certificates/search/byRegNumber/:regNum', (req, res) => {
  try {
    const regNum = req.params.regNum;
    const files = fs.readdirSync(dataDir);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const data = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
        if (data.registrationNumber && String(data.registrationNumber) === regNum) {
          res.json(data);
          return;
        }
      }
    }
    
    res.status(404).json({ error: 'الشهادة غير موجودة' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'خطأ في البحث عن الشهادة' });
  }
});

// حذف شهادة
app.delete('/api/certificates/:id', (req, res) => {
  try {
    const files = fs.readdirSync(dataDir);
    let deleted = false;
    
    for (const file of files) {
      if (file.startsWith(req.params.id)) {
        fs.unlinkSync(path.join(dataDir, file));
        deleted = true;
      }
    }
    
    if (deleted) {
      res.json({ success: true, message: 'تم حذف الشهادة بنجاح' });
    } else {
      res.status(404).json({ error: 'الشهادة غير موجودة' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'خطأ في حذف الشهادة' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎓 خادم الشهادات يعمل على المنفذ ${PORT}`);
  console.log(`📂 البيانات محفوظة في: ${dataDir}`);
});
