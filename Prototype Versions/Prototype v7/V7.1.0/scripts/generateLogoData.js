const fs = require('fs')
const path = require('path')

const assetsDir = path.join(__dirname, '..', 'src', 'assets')
const chBase64 = fs.readFileSync(path.join(assetsDir, 'chevron_nexus_logo.jpg')).toString('base64')
const nxBase64 = fs.readFileSync(path.join(assetsDir, 'nexusweb_logo.jpg')).toString('base64')

const csCode = `// Auto-generated Logo Data for NeXusWeb Setup
namespace ChevronNexus.NeXusWeb.Setup
{
    public static class LogoData
    {
        public const string ChevronNexusLogoBase64 = "${chBase64}";
        public const string NeXusWebLogoBase64 = "${nxBase64}";
    }
}
`

fs.writeFileSync(path.join(__dirname, 'LogoData.cs'), csCode, 'utf8')
console.log('Successfully generated scripts/LogoData.cs!')
