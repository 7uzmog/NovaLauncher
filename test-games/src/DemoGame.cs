// Mini "jeu" de démonstration compilé par scripts/make-test-games.mjs.
// Affiche son nom et sa version ; se ferme seul si NOVA_DEMO_AUTOCLOSE=<secondes>.
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

[assembly: System.Reflection.AssemblyTitle("__NAME__")]
[assembly: System.Reflection.AssemblyVersion("__VERSION__.0")]

class DemoGame : Form
{
    const string GameName = "__NAME__";
    const string GameVersion = "__VERSION__";
    static readonly Color A = ColorTranslator.FromHtml("__COLOR_A__");
    static readonly Color B = ColorTranslator.FromHtml("__COLOR_B__");

    DemoGame()
    {
        Text = GameName + " v" + GameVersion;
        ClientSize = new Size(960, 540);
        StartPosition = FormStartPosition.CenterScreen;
        DoubleBuffered = true;
        FormBorderStyle = FormBorderStyle.FixedSingle;
        MaximizeBox = false;

        var quit = new Button { Text = "Quitter", Size = new Size(140, 42), FlatStyle = FlatStyle.Flat, ForeColor = Color.White, BackColor = Color.FromArgb(60, 0, 0, 0) };
        quit.FlatAppearance.BorderColor = Color.White;
        quit.Location = new Point((ClientSize.Width - quit.Width) / 2, ClientSize.Height - 90);
        quit.Click += (s, e) => Close();
        Controls.Add(quit);

        var auto = Environment.GetEnvironmentVariable("NOVA_DEMO_AUTOCLOSE");
        int seconds;
        if (int.TryParse(auto, out seconds) && seconds > 0)
        {
            var t = new Timer { Interval = seconds * 1000 };
            t.Tick += (s, e) => Close();
            t.Start();
        }
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.AntiAlias;
        using (var bg = new LinearGradientBrush(ClientRectangle, A, B, 35f)) g.FillRectangle(bg, ClientRectangle);
        var center = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
        using (var title = new Font("Segoe UI", 44, FontStyle.Bold))
            g.DrawString(GameName.ToUpper(), title, Brushes.White, new RectangleF(0, 150, ClientSize.Width, 90), center);
        using (var sub = new Font("Segoe UI", 16))
        using (var brush = new SolidBrush(Color.FromArgb(210, 255, 255, 255)))
            g.DrawString("Version " + GameVersion + " — lancé depuis Nova Launcher", sub, brush, new RectangleF(0, 250, ClientSize.Width, 40), center);
    }

    [STAThread]
    static void Main()
    {
        Application.EnableVisualStyles();
        Application.Run(new DemoGame());
    }
}
