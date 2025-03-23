fn main(age: u8) {
  assert(age >= 18);
}

#[test]
fn test_main() {
    main(25);

    // Uncomment to make test fail
    // main(10);
}
