const express = require('express');
const { Spanner } = require('@google-cloud/spanner');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
app.use(express.json());

// CORS設定（全てのオリジンを許可）
app.use(cors({
  origin: '*',
  methods: 'GET,POST,PUT,DELETE',
  allowedHeaders: 'Content-Type'
}));

// Cloud Spanner セットアップ
const projectId = process.env.GCP_PROJECT_ID || 'taro-demo';
const instanceId = process.env.SPANNER_INSTANCE_ID || 'cafe-db';
const databaseId = process.env.SPANNER_DATABASE_ID || 'cafe';

const spanner = new Spanner({ projectId });
const instance = spanner.instance(instanceId);
const database = instance.database(databaseId);

// メニュー追加
app.post('/menu', async (req, res) => {
  const { name, description, price, available } = req.body;
  const menuId = uuidv4();

  if (!name || !description || price == null || available == null) {
    return res.status(400).json({ error: 'Invalid input data' });
  }

  try {
    await database.runTransactionAsync(async (transaction) => {
      const query = {
        sql: `INSERT INTO Menu (MenuId, Name, Description, Price, Available, CreatedAt) 
              VALUES (@menuId, @name, @description, @price, @available, PENDING_COMMIT_TIMESTAMP())`,
        params: { menuId, name, description, price, available },
      };
      await transaction.runUpdate(query);
      await transaction.commit();
    });

    // 新しく作成したメニューアイテムを返す
    const newMenuItem = {
      menuId,
      name,
      description,
      price,
      available,
      createdAt: new Date().toISOString(), // PENDING_COMMIT_TIMESTAMP() の値を取得する方法がないため
    };

    res.status(201).json(newMenuItem);
  } catch (error) {
    console.error('Error occurred during menu item creation:', error);
    res.status(500).json({ error: 'Failed to create menu item', details: error.message });
  }
});

// メニュー一覧取得
app.get('/menu', async (req, res) => {
  try {
    const [rows] = await database.run({
      sql: `SELECT * FROM Menu ORDER BY CreatedAt DESC`,
    });

    // プロパティ名を小文字のキャメルケースに変換
    const data = rows.map(row => {
      const item = row.toJSON();
      return {
        menuId: item.MenuId,
        name: item.Name,
        description: item.Description,
        price: item.Price,
        available: item.Available,
        createdAt: item.CreatedAt,
      };
    });

    res.json(data);
  } catch (error) {
    console.error('Error occurred while fetching menu items:', error);
    res.status(500).json({ error: 'Failed to fetch menu items', details: error.message });
  }
});

// メニュー更新
app.put('/menu/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, price, available } = req.body;

  if (!name || !description || price == null || available == null) {
    return res.status(400).json({ error: 'Invalid input data' });
  }

  try {
    await database.runTransactionAsync(async (transaction) => {
      const query = {
        sql: `UPDATE Menu SET Name = @name, Description = @description, Price = @price, Available = @available WHERE MenuId = @id`,
        params: { id, name, description, price, available },
      };
      await transaction.runUpdate(query);
      await transaction.commit();
    });

    // 更新後のメニューアイテムを取得して返す
    const [rows] = await database.run({
      sql: `SELECT * FROM Menu WHERE MenuId = @id`,
      params: { id },
    });

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    const item = rows[0].toJSON();
    const updatedMenuItem = {
      menuId: item.MenuId,
      name: item.Name,
      description: item.Description,
      price: item.Price,
      available: item.Available,
      createdAt: item.CreatedAt,
    };

    res.status(200).json(updatedMenuItem);
  } catch (error) {
    console.error('Error occurred while updating menu item:', error);
    res.status(500).json({ error: 'Failed to update menu item', details: error.message });
  }
});

// メニュー削除
app.delete('/menu/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await database.runTransactionAsync(async (transaction) => {
      const query = {
        sql: `DELETE FROM Menu WHERE MenuId = @id`,
        params: { id },
      };
      await transaction.runUpdate(query);
      await transaction.commit();
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error occurred while deleting menu item:', error);
    res.status(500).json({ error: 'Failed to delete menu item', details: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Menu API running on port ${PORT}`);
});
