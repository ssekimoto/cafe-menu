FROM node:20-alpine

# 作業ディレクトリを設定
WORKDIR /app

# 依存パッケージをインストール
COPY package*.json ./
RUN npm install

# アプリケーションのソースコードをコピー
COPY . .

# ポートの設定
EXPOSE 8080

# アプリケーションの起動
CMD ["npm", "start"]
