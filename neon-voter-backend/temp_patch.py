import re

with open('../nextjs-search-app/src/app/api/voters/route.ts', 'r') as f:
    content = f.read()

# Remove authDbPath
content = re.sub(r'const authDbPath = .*?\n', '', content)

# Replace authDb logic with in-memory map logic
auth_logic_pattern = r"const authDb = await open\(\{ filename: authDbPath, driver: sqlite3\.Database \}\);.*?try \{.*?finally \{\s*await authDb\.close\(\);\s*\}\s*\}"
replacement = """
      // Temporary in-memory rate limit for public/guests
      const rateLimitData = rateLimitMap.get(ip);
      const limit = role === 'guest' ? 4 : 2;
      if (query || ward) {
         if (rateLimitData) {
           if (rateLimitData.count >= limit) {
             const code = role === 'guest' ? 'QUOTA_EXCEEDED_GUEST' : 'QUOTA_EXCEEDED_PUBLIC';
             return NextResponse.json({ success: false, error: 'Daily search limit exceeded.', code }, { status: 429 });
           }
           rateLimitData.count++;
         } else {
           rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs24h });
         }
      }
"""
content = re.sub(auth_logic_pattern, replacement, content, flags=re.DOTALL)

with open('./src/app/api/voters/route.ts', 'w', encoding='utf-8') as f:
    f.write(content)
