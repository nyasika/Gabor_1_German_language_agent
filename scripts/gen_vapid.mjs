import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();
console.log('Put the PUBLIC key into web/config.js (vapidPublicKey) and the GitHub secret VAPID_PUBLIC_KEY.');
console.log('Keep the PRIVATE key only as the GitHub secret VAPID_PRIVATE_KEY. Never commit it.\n');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
