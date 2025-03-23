use dep::std::hash::sha256;

global MAX_LEASE_DURATION: u64 = 3650;

fn main(
    lease_bytes: [u8; 128],
    address_bytes: [u8; 64],
    owner_id_bytes: [u8; 32],
    lease_start: u64,
    lease_end: u64,
    daily_rate: u64,
    space_features: [u8; 16],
    signature: [u8; 64],
    
    expected_lease_hash: pub [u8; 32],
    expected_address_hash: pub [u8; 32],
    expected_owner_hash: pub [u8; 32],
    current_date: pub u64,
    expected_rate: pub u64,
    expected_features_hash: pub [u8; 32]
) {
    let lease_duration = lease_end - lease_start;
    assert(lease_duration > 0);
    assert(lease_duration <= MAX_LEASE_DURATION * 86400);

    let lease_hash = sha256(lease_bytes);
    assert(lease_hash == expected_lease_hash);

    let address_hash = sha256(address_bytes);
    assert(address_hash == expected_address_hash);

    let owner_hash = sha256(owner_id_bytes);
    assert(owner_hash == expected_owner_hash);
    assert(lease_start <= current_date);
    assert(current_date <= lease_end);
    assert(daily_rate == expected_rate);

    let features_hash = sha256(space_features);
    assert(features_hash == expected_features_hash);
    verify_signature(lease_hash, address_hash, owner_hash, signature);
}


fn verify_signature(
    lease_hash: [u8; 32],
    address_hash: [u8; 32],
    owner_hash: [u8; 32],
    signature: [u8; 64]
) {
    let mut message: [u8; 64] = [0; 64];
    for i in 0..32 {
        message[i] = lease_hash[i];
    }
    for i in 0..16 {
        message[32 + i] = address_hash[i];
    }
    for i in 0..16 {
        message[48 + i] = owner_hash[i];
    }
    
    for i in 0..32 {
        assert(signature[i] != 0);
    }

    let mut derived_id = [0; 32];
    for i in 0..32 {
        derived_id[i] = signature[32 + i] ^ signature[i];
    }
    assert(signature[0] != signature[32]);
}