using System;
using System.IO;
using System.IO.Compression;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;
using System.Threading;
using System.Reflection;
using Microsoft.Win32;
using System.Runtime.InteropServices;

[assembly: AssemblyTitle("NeXusWeb Setup & Upgrader")]
[assembly: AssemblyDescription("NeXusWeb Setup and In-Place Upgrader by Chevron Nexus Software")]
[assembly: AssemblyCompany("Chevron Nexus Software")]
[assembly: AssemblyProduct("NeXusWeb")]
[assembly: AssemblyCopyright("Copyright (C) 2026 Chevron Nexus Software")]
[assembly: AssemblyVersion("7.0.0.0")]
[assembly: AssemblyFileVersion("7.0.0.0")]

namespace ChevronNexus.NeXusWeb.Setup
{
    static class Program
    {
        [DllImport("user32.dll")]
        private static extern bool SetProcessDPIAware();

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool DeleteFile(string lpFileName);

        public static void UnblockFile(string path)
        {
            try
            {
                if (File.Exists(path))
                {
                    DeleteFile(path + ":Zone.Identifier");
                }
            }
            catch { }
        }

        public static void UnblockDirectory(string dirPath)
        {
            try
            {
                if (Directory.Exists(dirPath))
                {
                    foreach (var file in Directory.GetFiles(dirPath, "*.*", SearchOption.AllDirectories))
                    {
                        UnblockFile(file);
                    }
                }
            }
            catch { }
        }

        [STAThread]
        static void Main(string[] args)
        {
            try { SetProcessDPIAware(); } catch { }
            try { UnblockDirectory(AppDomain.CurrentDomain.BaseDirectory); } catch { }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            bool isSilent = false;
            bool isUninstall = false;

            if (args != null)
            {
                foreach (var arg in args)
                {
                    string a = arg.Trim().ToUpperInvariant();
                    if (a == "/S" || a == "/SILENT" || a == "/UPDATE" || a == "-SILENT" || a == "--SILENT")
                    {
                        isSilent = true;
                    }
                    else if (a == "/UNINSTALL" || a == "-UNINSTALL" || a == "/U")
                    {
                        isUninstall = true;
                    }
                }
            }

            if (isUninstall)
            {
                RunUninstaller(isSilent);
                return;
            }

            if (isSilent)
            {
                RunSilentInstallOrUpgrade();
            }
            else
            {
                Application.Run(new MultiStepSetupForm());
            }
        }

        public static string GetDefaultInstallDir()
        {
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            return Path.Combine(localAppData, "ChevronNexus", "NeXusWeb-V7");
        }

        public static bool IsExistingInstallation(string dir)
        {
            return Directory.Exists(dir) && (
                File.Exists(Path.Combine(dir, "NeXusWeb-V7.exe")) ||
                File.Exists(Path.Combine(dir, "NeXusWeb.exe"))
            );
        }

        public static void TerminateRunningProcesses()
        {
            string[] procNames = new string[] { "NeXusWeb-V7", "NeXusWeb-V5", "NeXusWeb" };
            foreach (var name in procNames)
            {
                try
                {
                    var procs = Process.GetProcessesByName(name);
                    foreach (var p in procs)
                    {
                        try
                        {
                            p.CloseMainWindow();
                            if (!p.WaitForExit(1500))
                            {
                                p.Kill();
                            }
                        }
                        catch { }
                    }
                }
                catch { }
            }
            Thread.Sleep(500);
        }

        public static void CreateShortcut(string shortcutPath, string targetPath, string description, string iconPath)
        {
            try
            {
                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType != null)
                {
                    dynamic shell = Activator.CreateInstance(shellType);
                    dynamic shortcut = shell.CreateShortcut(shortcutPath);
                    shortcut.TargetPath = targetPath;
                    shortcut.WorkingDirectory = Path.GetDirectoryName(targetPath);
                    shortcut.Description = description;
                    if (!string.IsNullOrEmpty(iconPath) && File.Exists(iconPath))
                    {
                        shortcut.IconLocation = iconPath + ",0";
                    }
                    shortcut.Save();
                }
            }
            catch { }
        }

        public static void RegisterUninstall(string installDir, string exePath)
        {
            try
            {
                using (var key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\NeXusWeb-V7"))
                {
                    if (key != null)
                    {
                        key.SetValue("DisplayName", "NeXusWeb (Chevron Nexus Software)");
                        key.SetValue("DisplayVersion", "7.0.0");
                        key.SetValue("Publisher", "Chevron Nexus Software");
                        key.SetValue("InstallLocation", installDir);
                        key.SetValue("DisplayIcon", exePath + ",0");
                        key.SetValue("UninstallString", "\"" + Path.Combine(installDir, "setup.exe") + "\" /UNINSTALL");
                        key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                        key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                    }
                }
            }
            catch { }
        }

        public static void UnregisterUninstall()
        {
            try
            {
                Registry.CurrentUser.DeleteSubKeyTree(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\NeXusWeb-V7", false);
            }
            catch { }
        }

        private static void RunSilentInstallOrUpgrade()
        {
            try
            {
                string targetDir = GetDefaultInstallDir();
                TerminateRunningProcesses();

                if (!Directory.Exists(targetDir))
                {
                    Directory.CreateDirectory(targetDir);
                }

                ExtractPayload(targetDir, null);

                string exePath = Path.Combine(targetDir, "NeXusWeb-V7.exe");
                string desktopPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "NeXusWeb V7.lnk");
                string startMenuPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "NeXusWeb V7.lnk");
                string appIcoPath = Path.Combine(targetDir, "app.ico");

                try
                {
                    Image img = ImageFromBase64(LogoData.NeXusWebLogoBase64);
                    if (img != null)
                    {
                        using (var bmp = new Bitmap(img, new Size(256, 256)))
                        {
                            IntPtr hIcon = bmp.GetHicon();
                            using (var ico = Icon.FromHandle(hIcon))
                            using (var fs = new FileStream(appIcoPath, FileMode.Create))
                            {
                                ico.Save(fs);
                            }
                        }
                    }
                }
                catch { }

                string iconTarget = File.Exists(appIcoPath) ? appIcoPath : exePath;
                CreateShortcut(desktopPath, exePath, "NeXusWeb V7 by Chevron Nexus Software", iconTarget);
                CreateShortcut(startMenuPath, exePath, "NeXusWeb V7 by Chevron Nexus Software", iconTarget);
                RegisterUninstall(targetDir, iconTarget);

                try
                {
                    string currentExe = Process.GetCurrentProcess().MainModule.FileName;
                    string destSetup = Path.Combine(targetDir, "setup.exe");
                    if (!string.Equals(currentExe, destSetup, StringComparison.OrdinalIgnoreCase))
                    {
                        File.Copy(currentExe, destSetup, true);
                    }
                }
                catch { }
            }
            catch { }
        }

        private static void RunUninstaller(bool isSilent)
        {
            try
            {
                if (!isSilent)
                {
                    var res = MessageBox.Show(
                        "Are you sure you want to uninstall NeXusWeb?\r\n\r\nNote: Your bookmarks and browser data in your user profile will be preserved.",
                        "Uninstall NeXusWeb",
                        MessageBoxButtons.YesNo,
                        MessageBoxIcon.Question
                    );
                    if (res != DialogResult.Yes) return;
                }

                TerminateRunningProcesses();

                string installDir = GetDefaultInstallDir();
                string desktopPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "NeXusWeb V7.lnk");
                string startMenuPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "NeXusWeb V7.lnk");

                try { if (File.Exists(desktopPath)) File.Delete(desktopPath); } catch { }
                try { if (File.Exists(startMenuPath)) File.Delete(startMenuPath); } catch { }
                UnregisterUninstall();

                string tempBat = Path.Combine(Path.GetTempPath(), "nexus_uninstall.bat");
                string script = string.Format(
                    "@echo off\r\n" +
                    "timeout /t 2 /nobreak > NUL\r\n" +
                    "rmdir /s /q \"{0}\"\r\n" +
                    "del \"%~f0\"\r\n",
                    installDir
                );
                File.WriteAllText(tempBat, script);

                Process.Start(new ProcessStartInfo
                {
                    FileName = "cmd.exe",
                    Arguments = "/c \"" + tempBat + "\"",
                    CreateNoWindow = true,
                    UseShellExecute = false
                });

                if (!isSilent)
                {
                    MessageBox.Show("NeXusWeb has been successfully uninstalled from your machine.", "Uninstall Complete", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
            }
            catch (Exception ex)
            {
                if (!isSilent)
                {
                    MessageBox.Show("Error during uninstall: " + ex.Message, "Uninstall Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
        }

        public static void ExtractPayload(string targetDir, Action<int, string> progressCallback)
        {
            if (progressCallback != null) progressCallback(10, "Searching for payload archive...");

            // 1. Check embedded resource first
            var assembly = Assembly.GetExecutingAssembly();
            Stream resourceStream = null;

            foreach (var resName in assembly.GetManifestResourceNames())
            {
                if (resName.EndsWith("app-payload.zip", StringComparison.OrdinalIgnoreCase))
                {
                    resourceStream = assembly.GetManifestResourceStream(resName);
                    break;
                }
            }

            if (resourceStream != null)
            {
                if (progressCallback != null) progressCallback(25, "Extracting application files...");
                using (var archive = new ZipArchive(resourceStream, ZipArchiveMode.Read))
                {
                    int count = archive.Entries.Count;
                    int current = 0;
                    foreach (var entry in archive.Entries)
                    {
                        current++;
                        string destPath = Path.Combine(targetDir, entry.FullName);
                        if (string.IsNullOrEmpty(entry.Name))
                        {
                            Directory.CreateDirectory(destPath);
                        }
                        else
                        {
                            Directory.CreateDirectory(Path.GetDirectoryName(destPath));
                            entry.ExtractToFile(destPath, true);
                        }
                        int pct = 25 + (int)((current / (float)count) * 60);
                        if (progressCallback != null) progressCallback(pct, "Extracting: " + entry.Name);
                    }
                }
                return;
            }

            // 2. Check companion zip or companion folder next to setup.exe
            string exeDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            string companionZip = Path.Combine(exeDir, "app-payload.zip");

            if (File.Exists(companionZip))
            {
                if (progressCallback != null) progressCallback(30, "Extracting payload archive...");
                using (var archive = ZipFile.OpenRead(companionZip))
                {
                    int count = archive.Entries.Count;
                    int current = 0;
                    foreach (var entry in archive.Entries)
                    {
                        current++;
                        string destPath = Path.Combine(targetDir, entry.FullName);
                        if (string.IsNullOrEmpty(entry.Name))
                        {
                            Directory.CreateDirectory(destPath);
                        }
                        else
                        {
                            Directory.CreateDirectory(Path.GetDirectoryName(destPath));
                            entry.ExtractToFile(destPath, true);
                        }
                        int pct = 30 + (int)((current / (float)count) * 55);
                        if (progressCallback != null) progressCallback(pct, "Extracting: " + entry.Name);
                    }
                }
                return;
            }

            string sourceDir = Path.Combine(exeDir, "NeXusWeb-V7-win32-x64");
            if (Directory.Exists(sourceDir))
            {
                if (progressCallback != null) progressCallback(30, "Copying application binaries...");
                CopyDirectoryRecursive(sourceDir, targetDir, progressCallback);
                return;
            }

            throw new FileNotFoundException("Could not find NeXusWeb installation payload archive.");
        }

        private static void CopyDirectoryRecursive(string sourceDir, string targetDir, Action<int, string> progressCallback)
        {
            var files = Directory.GetFiles(sourceDir, "*.*", SearchOption.AllDirectories);
            int count = files.Length;
            int current = 0;

            foreach (string file in files)
            {
                current++;
                string relative = file.Substring(sourceDir.Length).TrimStart('\\', '/');
                string dest = Path.Combine(targetDir, relative);
                Directory.CreateDirectory(Path.GetDirectoryName(dest));
                File.Copy(file, dest, true);

                int pct = 30 + (int)((current / (float)count) * 55);
                if (progressCallback != null) progressCallback(pct, "Copying: " + Path.GetFileName(file));
            }
        }

        public static Image ImageFromBase64(string b64)
        {
            try
            {
                if (!string.IsNullOrEmpty(b64))
                {
                    byte[] bytes = Convert.FromBase64String(b64);
                    using (var ms = new MemoryStream(bytes))
                    {
                        return Image.FromStream(ms);
                    }
                }
            }
            catch { }
            return null;
        }
    }

    public class MultiStepSetupForm : Form
    {
        private int currentStep = 1; // 1 to 4
        private const int TOTAL_STEPS = 4;

        // UI Containers
        private Panel sidebarPanel;
        private Panel contentPanel;
        private Panel footerPanel;
        private Button btnBack;
        private Button btnNext;
        private Button btnCancel;

        // Step Panels (4 Streamlined Layers)
        private Panel step1Panel;
        private Panel step2Panel;
        private Panel step3Panel;
        private Panel step4Panel;

        // Step 3 Controls (Destination & Install)
        private TextBox txtInstallDir;
        private Button btnBrowse;
        private CheckBox chkDesktop;
        private CheckBox chkStartMenu;
        private CheckBox chkLaunch;
        private ProgressBar progressBar;
        private Label lblStatus;
        private bool isInstalling = false;
        private bool isUpgradeMode = false;
        private string targetDir;

        // Step Sidebar Labels
        private Panel[] stepContainers = new Panel[TOTAL_STEPS];
        private Label[] stepNumberLabels = new Label[TOTAL_STEPS];
        private Label[] stepTextLabels = new Label[TOTAL_STEPS];

        // Logos
        private Image chevronLogo;
        private Image nexuswebLogo;

        public MultiStepSetupForm()
        {
            this.targetDir = Program.GetDefaultInstallDir();
            this.isUpgradeMode = Program.IsExistingInstallation(targetDir);

            // Load high-res logos from Base64 constants
            this.chevronLogo = Program.ImageFromBase64(LogoData.ChevronNexusLogoBase64);
            this.nexuswebLogo = Program.ImageFromBase64(LogoData.NeXusWebLogoBase64);

            InitializeComponent();
            ShowStep(1);
        }

        private void InitializeComponent()
        {
            this.Text = isUpgradeMode
                ? "Chevron Nexus Software — NeXusWeb v7.0.0 Setup & Upgrader"
                : "Chevron Nexus Software — NeXusWeb v7.0.0 Setup";

            // Clean, wide layout with zero clipping
            this.ClientSize = new Size(880, 580);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = true;
            this.BackColor = Color.FromArgb(13, 17, 29); // Dark Obsidian
            this.ForeColor = Color.FromArgb(241, 245, 249);
            this.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);

            // ── 1. Left Sidebar (Explicit Bounds: 0, 0, 230, 515) ─────────────
            sidebarPanel = new Panel
            {
                Location = new Point(0, 0),
                Size = new Size(230, 515),
                BackColor = Color.FromArgb(9, 12, 22),
                Padding = new Padding(16, 20, 16, 20)
            };

            Label lblSideBrand = new Label
            {
                Text = "CHEVRON NEXUS",
                Font = new Font("Segoe UI", 10.0f, FontStyle.Bold),
                ForeColor = Color.FromArgb(0, 212, 255),
                Location = new Point(16, 18),
                AutoSize = true
            };
            sidebarPanel.Controls.Add(lblSideBrand);

            Label lblSideProduct = new Label
            {
                Text = "NeXusWeb v7.0.0 Production",
                Font = new Font("Segoe UI", 8.0f, FontStyle.Regular),
                ForeColor = Color.FromArgb(148, 163, 184),
                Location = new Point(16, 40),
                AutoSize = true
            };
            sidebarPanel.Controls.Add(lblSideProduct);

            Panel sideDivider = new Panel
            {
                Location = new Point(16, 64),
                Size = new Size(198, 1),
                BackColor = Color.FromArgb(30, 41, 59)
            };
            sidebarPanel.Controls.Add(sideDivider);

            string[] stepTitles = new string[] {
                "About ChevronNexus",
                "About NeXusWeb",
                "Install Destination",
                "Finish & Thanks"
            };

            int stepY = 85;
            for (int i = 0; i < TOTAL_STEPS; i++)
            {
                Panel stepItem = new Panel
                {
                    Location = new Point(12, stepY),
                    Size = new Size(206, 52),
                    BackColor = Color.Transparent
                };

                Label lblNum = new Label
                {
                    Text = (i + 1).ToString(),
                    Location = new Point(8, 14),
                    Size = new Size(24, 24),
                    Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                    ForeColor = Color.FromArgb(148, 163, 184),
                    BackColor = Color.FromArgb(20, 28, 48),
                    TextAlign = ContentAlignment.MiddleCenter
                };

                Label lblText = new Label
                {
                    Text = stepTitles[i],
                    Location = new Point(38, 15),
                    Size = new Size(160, 22),
                    Font = new Font("Segoe UI", 8.5f, FontStyle.Regular),
                    ForeColor = Color.FromArgb(148, 163, 184),
                    TextAlign = ContentAlignment.MiddleLeft
                };

                stepContainers[i] = stepItem;
                stepNumberLabels[i] = lblNum;
                stepTextLabels[i] = lblText;

                stepItem.Controls.Add(lblNum);
                stepItem.Controls.Add(lblText);
                sidebarPanel.Controls.Add(stepItem);

                stepY += 60;
            }

            this.Controls.Add(sidebarPanel);

            // ── 2. Bottom Footer (Explicit Bounds: 0, 515, 880, 65) ───────────
            footerPanel = new Panel
            {
                Location = new Point(0, 515),
                Size = new Size(880, 65),
                BackColor = Color.FromArgb(8, 11, 20),
                Padding = new Padding(24, 14, 24, 14)
            };

            Panel footerBorder = new Panel
            {
                Location = new Point(0, 0),
                Size = new Size(880, 1),
                BackColor = Color.FromArgb(30, 41, 59)
            };
            footerPanel.Controls.Add(footerBorder);

            btnCancel = new Button
            {
                Text = "Cancel",
                Location = new Point(765, 14),
                Size = new Size(90, 36),
                BackColor = Color.FromArgb(30, 41, 59),
                ForeColor = Color.FromArgb(241, 245, 249),
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            btnCancel.FlatAppearance.BorderColor = Color.FromArgb(71, 85, 105);
            btnCancel.Click += (s, e) => this.Close();
            footerPanel.Controls.Add(btnCancel);

            btnNext = new Button
            {
                Text = "Next >",
                Location = new Point(635, 14),
                Size = new Size(120, 36),
                BackColor = Color.FromArgb(0, 212, 255),
                ForeColor = Color.FromArgb(0, 0, 0),
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            btnNext.FlatAppearance.BorderSize = 0;
            btnNext.Click += BtnNext_Click;
            footerPanel.Controls.Add(btnNext);

            btnBack = new Button
            {
                Text = "< Back",
                Location = new Point(530, 14),
                Size = new Size(95, 36),
                BackColor = Color.FromArgb(30, 41, 59),
                ForeColor = Color.FromArgb(241, 245, 249),
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand,
                Enabled = false
            };
            btnBack.FlatAppearance.BorderColor = Color.FromArgb(71, 85, 105);
            btnBack.Click += (s, e) => ShowStep(currentStep - 1);
            footerPanel.Controls.Add(btnBack);

            this.Controls.Add(footerPanel);

            // ── 3. Content Panel (Explicit Bounds: 230, 0, 650, 515) ──────────
            contentPanel = new Panel
            {
                Location = new Point(230, 0),
                Size = new Size(650, 515),
                BackColor = Color.FromArgb(13, 17, 29),
                Padding = new Padding(28, 20, 28, 20)
            };
            this.Controls.Add(contentPanel);

            BuildStep1Panel();
            BuildStep2Panel();
            BuildStep3Panel();
            BuildStep4Panel();
        }

        // ═════════════════════════════════════════════════════════════════════
        // 1st Layer: About Chevron Nexus (Exact Specs & Vision)
        // ═════════════════════════════════════════════════════════════════════
        private void BuildStep1Panel()
        {
            step1Panel = new Panel
            {
                Location = new Point(0, 0),
                Size = new Size(650, 515),
                BackColor = Color.Transparent,
                Visible = false
            };

            // Top Header with Logo
            PictureBox pic = new PictureBox
            {
                Location = new Point(24, 16),
                Size = new Size(90, 90),
                SizeMode = PictureBoxSizeMode.Zoom,
                Image = chevronLogo,
                BackColor = Color.FromArgb(18, 24, 40)
            };
            step1Panel.Controls.Add(pic);

            Label lblBadge = new Label
            {
                Text = "LOCAL-FIRST SOFTWARE • DECENTRALIZED INFRASTRUCTURE",
                Font = new Font("Segoe UI", 7.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(56, 189, 248),
                Location = new Point(125, 16),
                AutoSize = true
            };
            step1Panel.Controls.Add(lblBadge);

            Label lblHeader = new Label
            {
                Text = "About ChevronNexus",
                Font = new Font("Segoe UI", 16.0f, FontStyle.Bold),
                ForeColor = Color.FromArgb(255, 255, 255),
                Location = new Point(123, 34),
                Size = new Size(495, 30)
            };
            step1Panel.Controls.Add(lblHeader);

            LinkLabel lnkWeb = new LinkLabel
            {
                Text = "🌐 www.ChevronNexus.com",
                Font = new Font("Segoe UI", 9.0f, FontStyle.Bold),
                LinkColor = Color.FromArgb(0, 212, 255),
                Location = new Point(125, 68),
                AutoSize = true
            };
            lnkWeb.LinkClicked += (s, e) =>
            {
                try { Process.Start("https://www.ChevronNexus.com"); } catch { }
            };
            step1Panel.Controls.Add(lnkWeb);

            Label lblSimpleIdea = new Label
            {
                Text = "Software made with a simple idea: Your computer should work for you.",
                Font = new Font("Segoe UI", 9.0f, FontStyle.Italic),
                ForeColor = Color.FromArgb(203, 213, 225),
                Location = new Point(125, 90),
                Size = new Size(495, 20)
            };
            step1Panel.Controls.Add(lblSimpleIdea);

            // Scrollable Content Box
            Panel scrollBox = new Panel
            {
                Location = new Point(24, 116),
                Size = new Size(602, 385),
                BackColor = Color.FromArgb(19, 24, 41),
                AutoScroll = true,
                Padding = new Padding(14)
            };

            int curY = 12;

            // Intro text
            Label lblIntro = new Label
            {
                Text = "ChevronNexus is building a collection of local-first software designed to give you more control over your devices, your network, and your data.\r\n\r\n" +
                       "We believe useful software doesn't always need the cloud, a subscription, or a remote server.\r\n" +
                       "Sometimes, everything you need is already sitting on your desk.",
                Font = new Font("Segoe UI", 9.0f, FontStyle.Regular),
                ForeColor = Color.FromArgb(226, 232, 240),
                Location = new Point(12, curY),
                Size = new Size(555, 75)
            };
            scrollBox.Controls.Add(lblIntro);
            curY += 85;

            // Section: What We Build
            Panel pWhatWeBuild = new Panel
            {
                Location = new Point(12, curY),
                Size = new Size(555, 90),
                BackColor = Color.FromArgb(26, 33, 56),
                Padding = new Padding(12)
            };
            Label lblWbTitle = new Label
            {
                Text = "📦  WHAT WE BUILD",
                Font = new Font("Segoe UI", 9.0f, FontStyle.Bold),
                ForeColor = Color.FromArgb(0, 212, 255),
                Location = new Point(10, 8),
                AutoSize = true
            };
            Label lblWbDesc = new Label
            {
                Text = "Our software focuses on practical tools for everyday computing, local infrastructure, privacy, storage, media, and data.\r\n\r\n" +
                       "From turning a computer into your own local server with ChevronNexus Home, to investigating lost and deleted data with NeXus Miner, our goal is to make your hardware more capable.",
                Font = new Font("Segoe UI", 8.5f, FontStyle.Regular),
                ForeColor = Color.FromArgb(203, 213, 225),
                Location = new Point(10, 28),
                Size = new Size(535, 54)
            };
            pWhatWeBuild.Controls.Add(lblWbTitle);
            pWhatWeBuild.Controls.Add(lblWbDesc);
            scrollBox.Controls.Add(pWhatWeBuild);
            curY += 100;

            // Section: Our Approach Header
            Label lblApproachHeader = new Label
            {
                Text = "⚙️  OUR APPROACH",
                Font = new Font("Segoe UI", 9.0f, FontStyle.Bold),
                ForeColor = Color.FromArgb(56, 189, 248),
                Location = new Point(12, curY),
                AutoSize = true
            };
            scrollBox.Controls.Add(lblApproachHeader);
            curY += 24;

            string[,] pillars = new string[,] {
                { "🏠  Local when possible", "We prefer processing on your own hardware whenever practical." },
                { "🔒  Private by design", "Your personal data shouldn't be someone else's business model." },
                { "⚡  Simple to use", "Powerful software shouldn't require you to be an expert." },
                { "💎  Built to last", "We want our software to remain useful, not become something you have to constantly replace." }
            };

            for (int i = 0; i < 4; i++)
            {
                Panel pCard = new Panel
                {
                    Location = new Point(12, curY),
                    Size = new Size(555, 48),
                    BackColor = Color.FromArgb(26, 33, 56),
                    Padding = new Padding(10, 6, 10, 6)
                };
                Label pTitle = new Label
                {
                    Text = pillars[i, 0],
                    Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                    ForeColor = Color.FromArgb(192, 132, 252),
                    Location = new Point(8, 6),
                    AutoSize = true
                };
                Label pDesc = new Label
                {
                    Text = pillars[i, 1],
                    Font = new Font("Segoe UI", 8.0f, FontStyle.Regular),
                    ForeColor = Color.FromArgb(203, 213, 225),
                    Location = new Point(8, 25),
                    Size = new Size(535, 18)
                };
                pCard.Controls.Add(pTitle);
                pCard.Controls.Add(pDesc);
                scrollBox.Controls.Add(pCard);
                curY += 54;
            }

            // Section: A Note From ChevronNexus
            Panel pNote = new Panel
            {
                Location = new Point(12, curY),
                Size = new Size(555, 125),
                BackColor = Color.FromArgb(20, 28, 48),
                Padding = new Padding(12)
            };
            Label pNoteTitle = new Label
            {
                Text = "✍️  A NOTE FROM CHEVRON NEXUS",
                Font = new Font("Segoe UI", 9.0f, FontStyle.Bold),
                ForeColor = Color.FromArgb(34, 197, 94),
                Location = new Point(10, 8),
                AutoSize = true
            };
            Label pNoteDesc = new Label
            {
                Text = "We're still building.\r\n" +
                       "That means you'll see new ideas, improvements, experiments, and sometimes things that don't work exactly as planned.\r\n\r\n" +
                       "But every release has the same goal:\r\n" +
                       "Build something useful. Make it better. Give you more control.\r\n" +
                       "Thank you for choosing ChevronNexus.",
                Font = new Font("Segoe UI", 8.5f, FontStyle.Regular),
                ForeColor = Color.FromArgb(226, 232, 240),
                Location = new Point(10, 28),
                Size = new Size(535, 90)
            };
            pNote.Controls.Add(pNoteTitle);
            pNote.Controls.Add(pNoteDesc);
            scrollBox.Controls.Add(pNote);
            curY += 135;

            // Brand Motto & Copyright
            Panel pFooter = new Panel
            {
                Location = new Point(12, curY),
                Size = new Size(555, 80),
                BackColor = Color.FromArgb(14, 18, 32),
                Padding = new Padding(12)
            };
            Label lblMotto = new Label
            {
                Text = "Own Your Hardware.  •  Own Your Data.  •  Own Your Digital World.",
                Font = new Font("Segoe UI", 9.0f, FontStyle.Bold),
                ForeColor = Color.FromArgb(0, 212, 255),
                Location = new Point(10, 10),
                AutoSize = true
            };
            Label lblCopy = new Label
            {
                Text = "© 2026 ChevronNexus. All rights reserved.   |   Version: 7.0.0",
                Font = new Font("Segoe UI", 8.0f, FontStyle.Regular),
                ForeColor = Color.FromArgb(148, 163, 184),
                Location = new Point(10, 34),
                AutoSize = true
            };
            pFooter.Controls.Add(lblMotto);
            pFooter.Controls.Add(lblCopy);
            scrollBox.Controls.Add(pFooter);
            curY += 95;

            step1Panel.Controls.Add(scrollBox);
            contentPanel.Controls.Add(step1Panel);
        }

        // ═════════════════════════════════════════════════════════════════════
        // 2nd Layer: About NeXusWeb (Vision, Features, VPN & Sandboxes)
        // ═════════════════════════════════════════════════════════════════════
        private void BuildStep2Panel()
        {
            step2Panel = new Panel
            {
                Location = new Point(0, 0),
                Size = new Size(650, 515),
                BackColor = Color.Transparent,
                Visible = false
            };

            // Top Header with Logo
            PictureBox pic = new PictureBox
            {
                Location = new Point(24, 16),
                Size = new Size(90, 90),
                SizeMode = PictureBoxSizeMode.Zoom,
                Image = nexuswebLogo,
                BackColor = Color.FromArgb(18, 24, 40)
            };
            step2Panel.Controls.Add(pic);

            Label lblBadge = new Label
            {
                Text = "PRODUCTION RELEASE • VERSION 7.0.0",
                Font = new Font("Segoe UI", 7.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(192, 132, 252),
                Location = new Point(125, 16),
                AutoSize = true
            };
            step2Panel.Controls.Add(lblBadge);

            Label lblHeader = new Label
            {
                Text = "NeXusWeb Developer Browser",
                Font = new Font("Segoe UI", 16.0f, FontStyle.Bold),
                ForeColor = Color.FromArgb(255, 255, 255),
                Location = new Point(123, 34),
                Size = new Size(495, 30)
            };
            step2Panel.Controls.Add(lblHeader);

            Label lblTag = new Label
            {
                Text = "Unified Workstation & Privacy Web Infrastructure",
                Font = new Font("Segoe UI", 9.0f, FontStyle.Regular),
                ForeColor = Color.FromArgb(148, 163, 184),
                Location = new Point(125, 68),
                AutoSize = true
            };
            step2Panel.Controls.Add(lblTag);

            Label lblSub = new Label
            {
                Text = "Ad-Free • Tracker-Free • Native Tunnels • RAM Sandbox • Developer Suite",
                Font = new Font("Segoe UI", 8.0f, FontStyle.Bold),
                ForeColor = Color.FromArgb(56, 189, 248),
                Location = new Point(125, 90),
                AutoSize = true
            };
            step2Panel.Controls.Add(lblSub);

            // Scrollable Content Box
            Panel scrollBox = new Panel
            {
                Location = new Point(24, 116),
                Size = new Size(602, 385),
                BackColor = Color.FromArgb(19, 24, 41),
                AutoScroll = true,
                Padding = new Padding(14)
            };

            int curY = 12;

            // Section: THE VISION
            Panel pVision = new Panel
            {
                Location = new Point(12, curY),
                Size = new Size(555, 120),
                BackColor = Color.FromArgb(26, 33, 56),
                Padding = new Padding(12)
            };
            Label lblVisionTitle = new Label
            {
                Text = "🚀  THE VISION",
                Font = new Font("Segoe UI", 9.0f, FontStyle.Bold),
                ForeColor = Color.FromArgb(0, 212, 255),
                Location = new Point(10, 8),
                AutoSize = true
            };
            Label lblVisionText = new Label
            {
                Text = "Modern web development is often fragmented across multiple IDEs, terminal windows, browser tabs, port conflicts, and CORS headaches. Mainstream browsers are burdened with telemetry, heavy background bloat, and ad profiling.\r\n\r\n" +
                       "NeXusWeb was created with a clear vision: To build a unified, lightning-fast, and strictly private workstation browser that eliminates context switching for developers while giving everyone an ad-free, tracker-free web browsing experience.",
                Font = new Font("Segoe UI", 8.5f, FontStyle.Regular),
                ForeColor = Color.FromArgb(226, 232, 240),
                Location = new Point(10, 28),
                Size = new Size(535, 84)
            };
            pVision.Controls.Add(lblVisionTitle);
            pVision.Controls.Add(lblVisionText);
            scrollBox.Controls.Add(pVision);
            curY += 130;

            // Feature Highlights
            string[,] features = new string[,] {
                { "🕵️  Virtual Sandbox (Private Den) — Zero Trace Memory",
                  "RAM-only Private Den. Auto-wipe on close. Leaves zero disk footprint on host drives. Your private sessions, cookies, localStorage, and DOM cache execute strictly in temporary volatile RAM. The moment you close the Private Den tab, the sandbox automatically incinerates all traces without leaving forensic remnants.\r\n[No Tracking • No Trace • Just Privacy • Auto-Wipe Memory]" },

                { "🛡️  Direct VPN Tunnels — On-The-Go Mobility",
                  "1-Click location routing (Direct | NL | SG | US | UK | DE). Integrated free encrypted proxy tunnels directly into your workstation client. Test international localization, bypass local ISP censorship, or secure public WiFi traffic with single-click location routing." },

                { "🔒  Privacy Shield & Anti-Fingerprinting",
                  "Blocks 55+ tracker domains, enforces HTTPS upgrades, and spoofs canvas/audio fingerprinting." },

                { "🔌  Port Auto-Detector & Process Manager",
                  "Live polling of active localhost TCP listeners (Flask: 5000, Vite: 5173, React: 3000, Django: 8000) with 1-click PID killer." },

                { "💻  Built-in Multi-Terminal Shell",
                  "Full xterm.js + node-pty terminals with session tabs directly inside the browser." },

                { "🔍  Request Inspector (Network Logger)",
                  "Real-time HTTP/HTTPS network logging with status codes, headers, payloads, and latency metrics." },

                { "🔑  .env Workspace Reader",
                  "Safe inspection of workspace environment files with secret masking and copy tools." },

                { "↔️  Dual Synchronized Split View",
                  "Browse or test two web applications side-by-side in one window (Ctrl+Shift+S) with real-time draggable ratio." },

                { "🎥  Floating Video (Picture-in-Picture)",
                  "Pop out any video into an always-on-top floating player with global HUD controls." },

                { "📖  Distraction-Free Reader Mode",
                  "Article extractor with 10 custom typography fonts, themes, and font-size controls." },

                { "🌐  4 Dynamic Network Modes",
                  "Normal Web (DuckDuckGo & Tracker block), Strict Offline (Air-gapped 127.0.0.1), Local LAN (Intranet subnets), Developer (Unrestricted CORS & DevTools)." }
            };

            for (int i = 0; i < features.GetLength(0); i++)
            {
                int cardH = i < 2 ? 88 : 58;
                Panel fCard = new Panel
                {
                    Location = new Point(12, curY),
                    Size = new Size(555, cardH),
                    BackColor = Color.FromArgb(26, 33, 56),
                    Padding = new Padding(10, 6, 10, 6)
                };

                Label fTitle = new Label
                {
                    Text = features[i, 0],
                    Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                    ForeColor = Color.FromArgb(192, 132, 252),
                    Location = new Point(8, 6),
                    AutoSize = true
                };

                Label fDesc = new Label
                {
                    Text = features[i, 1],
                    Font = new Font("Segoe UI", 8.0f, FontStyle.Regular),
                    ForeColor = Color.FromArgb(203, 213, 225),
                    Location = new Point(8, 25),
                    Size = new Size(535, cardH - 30)
                };

                fCard.Controls.Add(fTitle);
                fCard.Controls.Add(fDesc);
                scrollBox.Controls.Add(fCard);
                curY += (cardH + 8);
            }

            step2Panel.Controls.Add(scrollBox);
            contentPanel.Controls.Add(step2Panel);
        }

        // ═════════════════════════════════════════════════════════════════════
        // 3rd Layer: Install Destination & Options (Browse Path)
        // ═════════════════════════════════════════════════════════════════════
        private void BuildStep3Panel()
        {
            step3Panel = new Panel
            {
                Location = new Point(0, 0),
                Size = new Size(650, 515),
                BackColor = Color.Transparent,
                Visible = false
            };

            Label lblTitle = new Label
            {
                Text = isUpgradeMode ? "NeXusWeb In-Place Upgrade (v7.0.0)" : "Installation Destination & Options",
                Font = new Font("Segoe UI", 16.0f, FontStyle.Bold),
                ForeColor = Color.FromArgb(0, 212, 255),
                Location = new Point(28, 20),
                AutoSize = true
            };
            step3Panel.Controls.Add(lblTitle);

            Label lblSub = new Label
            {
                Text = isUpgradeMode
                    ? "Existing installation detected. Upgrades engine to v7.0.0 while preserving 100% of your bookmarks, history, tabs, and local data."
                    : "Select the installation destination folder and shortcut preferences.",
                Font = new Font("Segoe UI", 9.0f, FontStyle.Regular),
                ForeColor = Color.FromArgb(148, 163, 184),
                Location = new Point(28, 54),
                Size = new Size(595, 32)
            };
            step3Panel.Controls.Add(lblSub);

            Panel pathCard = new Panel
            {
                Location = new Point(28, 95),
                Size = new Size(595, 95),
                BackColor = Color.FromArgb(19, 24, 41),
                Padding = new Padding(16)
            };

            Label lblPath = new Label
            {
                Text = "Destination Directory:",
                Location = new Point(14, 12),
                AutoSize = true,
                Font = new Font("Segoe UI", 9.0f, FontStyle.Bold),
                ForeColor = Color.FromArgb(203, 213, 225)
            };
            pathCard.Controls.Add(lblPath);

            txtInstallDir = new TextBox
            {
                Text = targetDir,
                Location = new Point(14, 38),
                Size = new Size(450, 28),
                BackColor = Color.FromArgb(26, 33, 56),
                ForeColor = Color.FromArgb(241, 245, 249),
                BorderStyle = BorderStyle.FixedSingle,
                Font = new Font("Segoe UI", 9.0f, FontStyle.Regular)
            };
            pathCard.Controls.Add(txtInstallDir);

            btnBrowse = new Button
            {
                Text = "Browse...",
                Location = new Point(475, 36),
                Size = new Size(100, 30),
                BackColor = Color.FromArgb(30, 41, 59),
                ForeColor = Color.FromArgb(241, 245, 249),
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            btnBrowse.FlatAppearance.BorderColor = Color.FromArgb(71, 85, 105);
            btnBrowse.Click += (s, e) =>
            {
                using (var fbd = new FolderBrowserDialog())
                {
                    fbd.Description = "Select NeXusWeb Installation Directory";
                    fbd.SelectedPath = txtInstallDir.Text;
                    if (fbd.ShowDialog() == DialogResult.OK)
                    {
                        txtInstallDir.Text = fbd.SelectedPath;
                        this.targetDir = fbd.SelectedPath;
                    }
                }
            };
            pathCard.Controls.Add(btnBrowse);
            step3Panel.Controls.Add(pathCard);

            // Options Card
            Panel optCard = new Panel
            {
                Location = new Point(28, 205),
                Size = new Size(595, 130),
                BackColor = Color.FromArgb(19, 24, 41),
                Padding = new Padding(16)
            };

            chkDesktop = new CheckBox
            {
                Text = "Create Desktop Shortcut",
                Checked = true,
                Location = new Point(16, 14),
                AutoSize = true,
                ForeColor = Color.FromArgb(226, 232, 240)
            };
            optCard.Controls.Add(chkDesktop);

            chkStartMenu = new CheckBox
            {
                Text = "Create Start Menu Shortcut",
                Checked = true,
                Location = new Point(16, 48),
                AutoSize = true,
                ForeColor = Color.FromArgb(226, 232, 240)
            };
            optCard.Controls.Add(chkStartMenu);

            chkLaunch = new CheckBox
            {
                Text = "Launch NeXusWeb when setup completes",
                Checked = true,
                Location = new Point(16, 82),
                AutoSize = true,
                ForeColor = Color.FromArgb(226, 232, 240)
            };
            optCard.Controls.Add(chkLaunch);
            step3Panel.Controls.Add(optCard);

            // Progress Bar & Status
            lblStatus = new Label
            {
                Text = "Ready to proceed.",
                Location = new Point(28, 355),
                Size = new Size(595, 24),
                ForeColor = Color.FromArgb(148, 163, 184)
            };
            step3Panel.Controls.Add(lblStatus);

            progressBar = new ProgressBar
            {
                Location = new Point(28, 385),
                Size = new Size(595, 18),
                Style = ProgressBarStyle.Continuous,
                Value = 0
            };
            step3Panel.Controls.Add(progressBar);

            contentPanel.Controls.Add(step3Panel);
        }

        // ═════════════════════════════════════════════════════════════════════
        // 4th Layer: Thanks For Choosing ChevronNexus & Note
        // ═════════════════════════════════════════════════════════════════════
        private void BuildStep4Panel()
        {
            step4Panel = new Panel
            {
                Location = new Point(0, 0),
                Size = new Size(650, 515),
                BackColor = Color.Transparent,
                Visible = false
            };

            // Logos Side-by-Side
            PictureBox picCh = new PictureBox
            {
                Location = new Point(28, 20),
                Size = new Size(90, 90),
                SizeMode = PictureBoxSizeMode.Zoom,
                Image = chevronLogo,
                BackColor = Color.FromArgb(18, 24, 40)
            };
            step4Panel.Controls.Add(picCh);

            PictureBox picNx = new PictureBox
            {
                Location = new Point(130, 20),
                Size = new Size(90, 90),
                SizeMode = PictureBoxSizeMode.Zoom,
                Image = nexuswebLogo,
                BackColor = Color.FromArgb(18, 24, 40)
            };
            step4Panel.Controls.Add(picNx);

            Label lblThanks = new Label
            {
                Text = "Thanks For Choosing ChevronNexus!",
                Font = new Font("Segoe UI", 16.0f, FontStyle.Bold),
                ForeColor = Color.FromArgb(0, 212, 255),
                Location = new Point(235, 28),
                Size = new Size(390, 34)
            };
            step4Panel.Controls.Add(lblThanks);

            Label lblDoneSub = new Label
            {
                Text = "NeXusWeb v7.0.0 is ready on your machine.",
                Font = new Font("Segoe UI", 9.5f, FontStyle.Regular),
                ForeColor = Color.FromArgb(148, 163, 184),
                Location = new Point(238, 68),
                AutoSize = true
            };
            step4Panel.Controls.Add(lblDoneSub);

            Panel cardPanel = new Panel
            {
                Location = new Point(28, 130),
                Size = new Size(595, 340),
                BackColor = Color.FromArgb(19, 24, 41),
                Padding = new Padding(18)
            };

            Label lblNoteTitle = new Label
            {
                Text = "A NOTE FROM CHEVRON NEXUS",
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(56, 189, 248),
                Location = new Point(14, 14),
                AutoSize = true
            };
            cardPanel.Controls.Add(lblNoteTitle);

            Label lblNote = new Label
            {
                Text = "Thank you for joining the movement for digital sovereignty. We believe software should empower you, respect your privacy, and never rent back your own hardware to you.\r\n\r\n" +
                       "NeXusWeb is built local-first. Your bookmarks, tabs, notes, and history will always remain in your hands.\r\n\r\n" +
                       "Enjoy seamless, secure, and blazingly fast web browsing!",
                Font = new Font("Segoe UI", 9.5f, FontStyle.Regular),
                ForeColor = Color.FromArgb(226, 232, 240),
                Location = new Point(14, 40),
                Size = new Size(565, 140)
            };
            cardPanel.Controls.Add(lblNote);

            Panel pSummary = new Panel
            {
                Location = new Point(14, 195),
                Size = new Size(565, 120),
                BackColor = Color.FromArgb(26, 33, 56),
                Padding = new Padding(14)
            };

            Label s1 = new Label { Text = "Installed Build: NeXusWeb v7.0.0 Stable (x64 Windows)", Location = new Point(14, 12), AutoSize = true, ForeColor = Color.FromArgb(0, 212, 255), Font = new Font("Segoe UI", 9.0f, FontStyle.Bold) };
            Label s2 = new Label { Text = "Publisher: Chevron Nexus Software", Location = new Point(14, 38), AutoSize = true, ForeColor = Color.FromArgb(148, 163, 184) };
            Label s3 = new Label { Text = "Website: www.ChevronNexus.com", Location = new Point(14, 64), AutoSize = true, ForeColor = Color.FromArgb(148, 163, 184) };
            Label s4 = new Label { Text = "Privacy Guarantee: 100% Local-First & Zero Telemetry", Location = new Point(14, 90), AutoSize = true, ForeColor = Color.FromArgb(34, 197, 94) };

            pSummary.Controls.Add(s1);
            pSummary.Controls.Add(s2);
            pSummary.Controls.Add(s3);
            pSummary.Controls.Add(s4);
            cardPanel.Controls.Add(pSummary);

            step4Panel.Controls.Add(cardPanel);
            contentPanel.Controls.Add(step4Panel);
        }

        // ═════════════════════════════════════════════════════════════════════
        // Step Navigation Controller (4 Streamlined Steps)
        // ═════════════════════════════════════════════════════════════════════
        private void ShowStep(int step)
        {
            if (step < 1 || step > TOTAL_STEPS) return;
            currentStep = step;

            step1Panel.Visible = (step == 1);
            step2Panel.Visible = (step == 2);
            step3Panel.Visible = (step == 3);
            step4Panel.Visible = (step == 4);

            // Update Sidebar highlighting
            for (int i = 0; i < TOTAL_STEPS; i++)
            {
                if (i + 1 == step)
                {
                    stepNumberLabels[i].ForeColor = Color.FromArgb(0, 0, 0);
                    stepNumberLabels[i].BackColor = Color.FromArgb(0, 212, 255);
                    stepTextLabels[i].ForeColor = Color.FromArgb(0, 212, 255);
                    stepTextLabels[i].Font = new Font("Segoe UI", 9.0f, FontStyle.Bold);
                    stepContainers[i].BackColor = Color.FromArgb(20, 28, 48);
                }
                else if (i + 1 < step)
                {
                    stepNumberLabels[i].ForeColor = Color.FromArgb(255, 255, 255);
                    stepNumberLabels[i].BackColor = Color.FromArgb(34, 197, 94); // Completed Green
                    stepTextLabels[i].ForeColor = Color.FromArgb(34, 197, 94);
                    stepTextLabels[i].Font = new Font("Segoe UI", 8.5f, FontStyle.Regular);
                    stepContainers[i].BackColor = Color.Transparent;
                }
                else
                {
                    stepNumberLabels[i].ForeColor = Color.FromArgb(100, 116, 139);
                    stepNumberLabels[i].BackColor = Color.FromArgb(20, 28, 48);
                    stepTextLabels[i].ForeColor = Color.FromArgb(100, 116, 139);
                    stepTextLabels[i].Font = new Font("Segoe UI", 8.5f, FontStyle.Regular);
                    stepContainers[i].BackColor = Color.Transparent;
                }
            }

            btnBack.Enabled = (step > 1 && step < 4 && !isInstalling);

            if (step == 3)
            {
                btnNext.Text = isUpgradeMode ? "Upgrade Now" : "Install Now";
                btnNext.Enabled = !isInstalling;
            }
            else if (step == 4)
            {
                btnNext.Text = "Launch & Finish";
                btnNext.Enabled = true;
                btnBack.Visible = false;
                btnCancel.Visible = false;
            }
            else
            {
                btnNext.Text = "Next >";
                btnNext.Enabled = true;
            }
        }

        private void BtnNext_Click(object sender, EventArgs e)
        {
            if (currentStep == 3)
            {
                StartInstallation();
            }
            else if (currentStep == 4)
            {
                string exePath = Path.Combine(targetDir, "NeXusWeb-V7.exe");
                if (chkLaunch.Checked && File.Exists(exePath))
                {
                    try
                    {
                        Process.Start(new ProcessStartInfo
                        {
                            FileName = exePath,
                            WorkingDirectory = targetDir,
                            UseShellExecute = true
                        });
                    }
                    catch { }
                }
                this.Close();
            }
            else
            {
                ShowStep(currentStep + 1);
            }
        }

        private void StartInstallation()
        {
            isInstalling = true;
            btnNext.Enabled = false;
            btnBack.Enabled = false;
            btnCancel.Enabled = false;
            btnBrowse.Enabled = false;
            txtInstallDir.ReadOnly = true;
            chkDesktop.Enabled = false;
            chkStartMenu.Enabled = false;
            chkLaunch.Enabled = false;

            this.targetDir = txtInstallDir.Text.Trim();
            if (string.IsNullOrEmpty(this.targetDir))
            {
                this.targetDir = Program.GetDefaultInstallDir();
            }

            Thread worker = new Thread(() =>
            {
                try
                {
                    UpdateStatus(5, "Terminating any running NeXusWeb instances...");
                    Program.TerminateRunningProcesses();

                    UpdateStatus(15, "Preparing target installation directory...");
                    if (!Directory.Exists(targetDir))
                    {
                        Directory.CreateDirectory(targetDir);
                    }

                    Program.ExtractPayload(targetDir, (pct, status) =>
                    {
                        UpdateStatus(pct, status);
                    });

                    UpdateStatus(88, "Configuring shortcuts and Windows integration...");
                    string exePath = Path.Combine(targetDir, "NeXusWeb-V7.exe");
                    string appIcoPath = Path.Combine(targetDir, "app.ico");

                    try
                    {
                        Image img = Program.ImageFromBase64(LogoData.NeXusWebLogoBase64);
                        if (img != null)
                        {
                            using (var bmp = new Bitmap(img, new Size(256, 256)))
                            {
                                IntPtr hIcon = bmp.GetHicon();
                                using (var ico = Icon.FromHandle(hIcon))
                                using (var fs = new FileStream(appIcoPath, FileMode.Create))
                                {
                                    ico.Save(fs);
                                }
                            }
                        }
                    }
                    catch { }

                    string iconTarget = File.Exists(appIcoPath) ? appIcoPath : exePath;

                    if (chkDesktop.Checked)
                    {
                        string desktopPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "NeXusWeb V7.lnk");
                        Program.CreateShortcut(desktopPath, exePath, "NeXusWeb V7 by Chevron Nexus Software", iconTarget);
                    }

                    if (chkStartMenu.Checked)
                    {
                        string startMenuPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "NeXusWeb V7.lnk");
                        Program.CreateShortcut(startMenuPath, exePath, "NeXusWeb V7 by Chevron Nexus Software", iconTarget);
                    }

                    Program.RegisterUninstall(targetDir, iconTarget);

                    try
                    {
                        string currentExe = Process.GetCurrentProcess().MainModule.FileName;
                        string destSetup = Path.Combine(targetDir, "setup.exe");
                        if (!string.Equals(currentExe, destSetup, StringComparison.OrdinalIgnoreCase))
                        {
                            File.Copy(currentExe, destSetup, true);
                        }
                    }
                    catch { }

                    // Strip any Mark-of-the-Web streams across entire target directory to prevent Smart App Control blocks
                    Program.UnblockDirectory(targetDir);

                    UpdateStatus(100, isUpgradeMode ? "Upgrade complete! All user data preserved." : "Installation completed successfully!");

                    this.Invoke(new Action(() =>
                    {
                        isInstalling = false;
                        ShowStep(4);
                    }));
                }
                catch (Exception ex)
                {
                    this.Invoke(new Action(() =>
                    {
                        isInstalling = false;
                        lblStatus.ForeColor = Color.FromArgb(248, 113, 113);
                        lblStatus.Text = "Error: " + ex.Message;
                        btnCancel.Enabled = true;
                        btnBack.Enabled = true;
                        btnNext.Enabled = true;
                        MessageBox.Show("Installation failed: " + ex.Message, "Setup Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    }));
                }
            });

            worker.IsBackground = true;
            worker.Start();
        }

        private void UpdateStatus(int progress, string text)
        {
            if (this.IsDisposed || !this.IsHandleCreated) return;
            this.Invoke(new Action(() =>
            {
                progressBar.Value = Math.Min(100, Math.Max(0, progress));
                lblStatus.Text = text;
            }));
        }
    }
}
