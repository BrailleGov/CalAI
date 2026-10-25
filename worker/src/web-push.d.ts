declare module 'web-push' {
  type Subscription = {
    endpoint: string;
    expirationTime?: number | null;
    keys: { p256dh: string; auth: string };
  };

  type VapidDetails = {
    subject: string;
    publicKey: string;
    privateKey: string;
  };

  type SendResult = {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  };

  const webpush: {
    setVapidDetails(
      subject: string,
      publicKey: string,
      privateKey: string
    ): void;
    sendNotification(
      subscription: Subscription,
      payload?: string | Buffer,
      options?: { TTL?: number; urgency?: 'very-low' | 'low' | 'normal' | 'high' }
    ): Promise<SendResult>;
    generateVAPIDKeys(): { publicKey: string; privateKey: string };
  };

  export default webpush;
}
