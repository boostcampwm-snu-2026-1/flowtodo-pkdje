import { MongoClient, type MongoClientOptions } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error(
    'MONGODB_URI is not set. Define it in .env.local (see .env.example).',
  );
}

const options: MongoClientOptions = {};

let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // dev: hot reload 가 모듈을 재실행해도 같은 client 를 재사용하기 위해 globalThis 캐싱
  const globalWithMongo = globalThis as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };
  if (!globalWithMongo._mongoClientPromise) {
    const client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // prod: 모듈 로딩 시 한 번 connect
  const client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;
