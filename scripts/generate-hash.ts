import bcrypt from 'bcryptjs'

async function main() {
  const password = 'password123'
  const hash = await bcrypt.hash(password, 10)
  console.log('Password hash for "password123":')
  console.log(hash)
}

main().catch(console.error)
