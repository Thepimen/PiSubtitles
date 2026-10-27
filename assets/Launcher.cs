using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Windows.Forms;

[assembly: AssemblyTitle("PiSubtitles Studio")]
[assembly: AssemblyDescription("Estudio Profesional de Subtitulado Automatico con IA para Creadores")]
[assembly: AssemblyCompany("PiSubtitles Open Source")]
[assembly: AssemblyProduct("PiSubtitles Studio")]
[assembly: AssemblyVersion("2.0.0.0")]
[assembly: AssemblyFileVersion("2.0.0.0")]

namespace PiSubtitlesLauncher
{
    static class Program
    {
        [DllImport("user32.dll")]
        static extern bool AllowSetForegroundWindow(int dwProcessId);

        [STAThread]
        static void Main(string[] args)
        {
            string appDir = AppDomain.CurrentDomain.BaseDirectory;
            Directory.SetCurrentDirectory(appDir);

            string mainPy = Path.Combine(appDir, "main.py");
            if (!File.Exists(mainPy))
            {
                MessageBox.Show(
                    "No se encontro el archivo 'main.py' en:\n" + appDir,
                    "PiSubtitles Studio - Error",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return;
            }

            string pythonExe = FindPythonExecutable(appDir);
            if (string.IsNullOrEmpty(pythonExe))
            {
                MessageBox.Show(
                    "No se encontro Python 3.10+ en el sistema.\nPor favor ejecuta setup.bat.",
                    "PiSubtitles Studio",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning
                );
                return;
            }

            try
            {
                AllowSetForegroundWindow(-1);

                bool isPythonW = pythonExe.EndsWith("pythonw.exe", StringComparison.OrdinalIgnoreCase);
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = pythonExe,
                    Arguments = "\"" + mainPy + "\"",
                    WorkingDirectory = appDir,
                    UseShellExecute = true,
                    WindowStyle = isPythonW ? ProcessWindowStyle.Normal : ProcessWindowStyle.Hidden
                };

                Process proc = Process.Start(psi);
                if (proc != null)
                {
                    AllowSetForegroundWindow(proc.Id);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "Error al iniciar PiSubtitles Studio:\n" + ex.Message,
                    "PiSubtitles Studio - Error",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
        }

        static string FindPythonExecutable(string appDir)
        {
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string[] candidates = new string[]
            {
                Path.Combine(localAppData, "Programs", "Python", "Python313", "pythonw.exe"),
                Path.Combine(appDir, ".venv", "Scripts", "pythonw.exe"),
                Path.Combine(localAppData, "Programs", "Python", "Python312", "pythonw.exe"),
                Path.Combine(localAppData, "Programs", "Python", "Python311", "pythonw.exe"),
                Path.Combine(localAppData, "Programs", "Python", "Python313", "python.exe"),
                Path.Combine(appDir, ".venv", "Scripts", "python.exe")
            };

            foreach (string path in candidates)
            {
                if (!string.IsNullOrEmpty(path) && File.Exists(path))
                {
                    return path;
                }
            }

            return null;
        }
    }
}
