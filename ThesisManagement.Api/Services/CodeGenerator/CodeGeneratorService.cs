using System;

namespace ThesisManagement.Api.Services
{
    public class CodeGeneratorService : ICodeGenerator
    {
        // Thread-safe generator: prefix + yyyyMMddHHmmss + random 6-digit
        public string Generate(string prefix)
        {
            var now = DateTime.UtcNow;
            var stamp = now.ToString("yyyyMMddHHmmss");
            var rnd = Random.Shared.Next(100000, 999999);
            return $"{prefix}_{stamp}_{rnd}";
        }
    }
}
