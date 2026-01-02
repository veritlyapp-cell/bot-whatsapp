/**
 * Check Stores Structure
 * Reads one store from Firestore to check for coordinates
 */

import { db } from '../config/firebase.js';

async function checkStores() {
    try {
        console.log('🔍 Checking stores structure for tenant "ngr"...');

        // Get first store from 'ngr' tenant
        const storesSnap = await db.collection('tenants').doc('ngr')
            .collection('tiendas').limit(1).get();

        if (storesSnap.empty) {
            console.log('❌ No stores found for tenant "ngr". Checking all tenants...');

            const tenantsSnap = await db.collection('tenants').limit(1).get();
            if (tenantsSnap.empty) {
                console.log('❌ No tenants found at all.');
                return;
            }

            const tenantId = tenantsSnap.docs[0].id;
            console.log(`Checking tenant: ${tenantId}`);
            const otherStoresSnap = await db.collection('tenants').doc(tenantId).collection('tiendas').limit(1).get();

            if (otherStoresSnap.empty) {
                console.log('❌ No stores found in first tenant either.');
                return;
            }

            const store = otherStoresSnap.docs[0].data();
            printStoreInfo(store);
            return;
        }

        const store = storesSnap.docs[0].data();
        printStoreInfo(store);

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

function printStoreInfo(store) {
    console.log('🏪 Store Data:', JSON.stringify(store, null, 2));

    if (store.lat || store.latitude || store.coordinates || store.ubicacion) {
        console.log('✅ Coordinates found!');
        if (store.lat) console.log(`   lat: ${store.lat}`);
        if (store.latitude) console.log(`   latitude: ${store.latitude}`);
    } else {
        console.log('⚠️ No coordinates found in store document');
    }
}

checkStores();
