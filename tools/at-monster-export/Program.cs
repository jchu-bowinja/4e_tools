using System;
using System.Collections;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Xml;

namespace AtMonsterExport
{
    internal static class Program
    {
        private static int Main(string[] args)
        {
            try
            {
                return Run(args);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Error: " + ex.Message);
                Console.Error.WriteLine(ex);
                return 1;
            }
        }

        private static int Run(string[] args)
        {
            var options = ExportOptions.Parse(args);
            if (options.ShowHelp)
            {
                PrintHelp();
                return 0;
            }

            var adventureToolsDir = ResolveAdventureToolsDir(options.AdventureToolsDir);
            var sourceDataDir = Path.Combine(adventureToolsDir, "Data");
            if (!Directory.Exists(sourceDataDir))
            {
                throw new DirectoryNotFoundException("Adventure Tools Data folder not found: " + sourceDataDir);
            }

            Directory.CreateDirectory(options.OutputDir);

            var dataDir = PrepareDataDirectory(adventureToolsDir, sourceDataDir, options.CacheDir);
            var dataRootDir = Path.GetDirectoryName(dataDir);
            Directory.SetCurrentDirectory(dataRootDir);

            var assemblies = AdventureToolsLoader.Load(adventureToolsDir);
            var runtime = AdventureToolsRuntime.Create(assemblies, dataRootDir, options.ApplicationId);

            var monsters = runtime.GetMonsters();
            Console.WriteLine("Loaded {0} monster index entries from {1}", monsters.Count, dataDir);

            if (monsters.Count <= 10)
            {
                Console.Error.WriteLine(
                    "Warning: expected thousands of monsters but only found {0}. Close Adventure Tools if it is running, then retry.",
                    monsters.Count);
            }

            var exported = 0;
            var skipped = 0;
            var failed = 0;
            var attempted = 0;

            foreach (var monster in monsters)
            {
                if (options.Limit.HasValue && attempted >= options.Limit.Value)
                {
                    break;
                }

                attempted++;

                var name = runtime.GetMonsterName(monster);
                var id = runtime.GetMonsterId(monster);
                var fileName = BuildFileName(name, id);
                var outputPath = Path.Combine(options.OutputDir, fileName);

                if (!options.Force && File.Exists(outputPath))
                {
                    skipped++;
                    continue;
                }

                try
                {
                    runtime.LoadBody(monster);
                    var xml = runtime.ExportMonsterXml(monster);
                    File.WriteAllText(outputPath, xml, new UTF8Encoding(true));
                    exported++;

                    if (exported % 250 == 0)
                    {
                        Console.WriteLine("Exported {0} monsters...", exported);
                    }
                }
                catch (Exception ex)
                {
                    failed++;
                    Console.Error.WriteLine(
                        "Failed to export {0} ({1}): {2}",
                        name,
                        id,
                        UnwrapException(ex).Message);
                }
            }

            Console.WriteLine(
                "Done. exported={0} skipped={1} failed={2} output={3}",
                exported,
                skipped,
                failed,
                options.OutputDir);
            return failed > 0 ? 2 : 0;
        }

        private static Exception UnwrapException(Exception ex)
        {
            while (ex is TargetInvocationException && ex.InnerException != null)
            {
                ex = ex.InnerException;
            }

            return ex;
        }

        private static string PrepareDataDirectory(string adventureToolsDir, string sourceDataDir, string cacheDir)
        {
            if (string.IsNullOrWhiteSpace(cacheDir))
            {
                return sourceDataDir;
            }

            var resolvedCache = Path.GetFullPath(cacheDir.Trim());
            var cacheDataDir = Path.Combine(resolvedCache, "Data");
            Directory.CreateDirectory(cacheDataDir);

            foreach (var file in Directory.GetFiles(sourceDataDir))
            {
                var target = Path.Combine(cacheDataDir, Path.GetFileName(file));
                File.Copy(file, target, true);
            }

            Console.WriteLine("Using cached Adventure Tools data at {0}", cacheDataDir);
            return cacheDataDir;
        }

        private static string ResolveAdventureToolsDir(string configured)
        {
            if (!string.IsNullOrWhiteSpace(configured))
            {
                var full = Path.GetFullPath(configured.Trim());
                if (!Directory.Exists(full))
                {
                    throw new DirectoryNotFoundException("Adventure Tools directory not found: " + full);
                }

                return full;
            }

            var programFilesX86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
            var defaultPath = Path.Combine(programFilesX86, "Wizards of the Coast", "Adventure Tools");
            if (Directory.Exists(defaultPath))
            {
                return defaultPath;
            }

            throw new InvalidOperationException(
                "Adventure Tools directory not found. Pass --adventure-tools \"C:\\Path\\To\\Adventure Tools\".");
        }

        private static string BuildFileName(string name, string id)
        {
            var slug = System.Text.RegularExpressions.Regex.Replace(
                name.Trim().ToLowerInvariant(),
                @"[^a-z0-9]+",
                "-").Trim('-');
            if (string.IsNullOrWhiteSpace(slug))
            {
                slug = "monster";
            }

            if (!string.IsNullOrWhiteSpace(id))
            {
                var safeId = System.Text.RegularExpressions.Regex.Replace(id.Trim(), @"[^a-zA-Z0-9._-]+", "_");
                return slug + "__" + safeId + ".monster";
            }

            return slug + ".monster";
        }

        private static void PrintHelp()
        {
            Console.WriteLine(
                @"Export Adventure Tools monsters to .monster XML for 4e_builder ETL.

Usage:
  at-monster-export.exe [options]

Options:
  --adventure-tools <dir>  Adventure Tools install directory
                           (default: Program Files (x86)\Wizards of the Coast\Adventure Tools)
  --output <dir>           Output directory for .monster files (default: generated/at-monsters)
  --cache-dir <dir>        Copy Data/*.data and Monster.package here before reading (avoids file locks)
  --application-id <guid>  Adventure Tools application id (optional override)
  --limit <n>              Process at most N monsters (for testing)
  --force                  Overwrite existing .monster files
  --help                   Show this help

After export, run the Python monster ETL:
  python tools/etl/build_monster_index.py <output-dir> generated/monsters");
        }
    }

    internal sealed class ExportOptions
    {
        private const string DefaultApplicationId = "3b74d6e8-af6c-45cf-b82c-d88fa96891a3";

        public ExportOptions()
        {
            OutputDir = Path.GetFullPath(Path.Combine("generated", "at-monsters"));
            ApplicationId = DefaultApplicationId;
        }

        public string AdventureToolsDir { get; private set; }
        public string OutputDir { get; private set; }
        public string CacheDir { get; private set; }
        public string ApplicationId { get; private set; }
        public int? Limit { get; private set; }
        public bool Force { get; private set; }
        public bool ShowHelp { get; private set; }

        public static ExportOptions Parse(string[] args)
        {
            var options = new ExportOptions();
            for (var i = 0; i < args.Length; i++)
            {
                var arg = args[i];
                switch (arg)
                {
                    case "--help":
                    case "-h":
                        options.ShowHelp = true;
                        break;
                    case "--adventure-tools":
                        options.AdventureToolsDir = RequireValue(args, ref i, arg);
                        break;
                    case "--output":
                        options.OutputDir = Path.GetFullPath(RequireValue(args, ref i, arg));
                        break;
                    case "--cache-dir":
                        options.CacheDir = RequireValue(args, ref i, arg);
                        break;
                    case "--application-id":
                        options.ApplicationId = RequireValue(args, ref i, arg);
                        break;
                    case "--limit":
                        options.Limit = int.Parse(RequireValue(args, ref i, arg));
                        break;
                    case "--force":
                        options.Force = true;
                        break;
                    default:
                        throw new ArgumentException("Unknown argument: " + arg);
                }
            }

            return options;
        }

        private static string RequireValue(string[] args, ref int index, string flag)
        {
            if (index + 1 >= args.Length)
            {
                throw new ArgumentException("Missing value for " + flag);
            }

            index++;
            return args[index];
        }
    }

    internal sealed class AdventureToolsAssemblies
    {
        public Assembly Monsters { get; set; }
        public Assembly Core { get; set; }
        public Assembly XamlUtilities { get; set; }
        public Assembly MonstersViewModel { get; set; }
        public Type MonsterType { get; set; }
        public Type MonsterDataType { get; set; }
        public Type CoreDataType { get; set; }
        public Type ModelRootsType { get; set; }
        public Type ModelRootType { get; set; }
        public Type DataSerializerType { get; set; }
        public Type SerializationModeType { get; set; }
        public Type DataStoreFileStreamSourceType { get; set; }
        public Type EncryptedFileStreamLoaderType { get; set; }
        public Type NewFormatListLoaderType { get; set; }
        public Type CurrentListLoaderType { get; set; }
        public Type BetaListLoaderType { get; set; }
        public Type ListLoaderType { get; set; }
        public Type IStreamSourceType { get; set; }
        public object ExportAllMode { get; set; }
    }

    internal static class AdventureToolsLoader
    {
        private static string _adventureToolsDir;

        public static AdventureToolsAssemblies Load(string adventureToolsDir)
        {
            _adventureToolsDir = adventureToolsDir;
            AppDomain.CurrentDomain.AssemblyResolve += OnAssemblyResolve;

            var core = Assembly.LoadFrom(Path.Combine(adventureToolsDir, "AdventureTools.Core.dll"));
            var monsters = Assembly.LoadFrom(Path.Combine(adventureToolsDir, "AdventureTools.Monsters.dll"));
            var xamlUtilities = Assembly.LoadFrom(Path.Combine(adventureToolsDir, "XAMLUtilities.dll"));
            Assembly.LoadFrom(Path.Combine(adventureToolsDir, "ApplicationUpdate.Client.dll"));
            var monstersViewModel = Assembly.LoadFrom(Path.Combine(adventureToolsDir, "AdventureTools.Monsters.ViewModel.dll"));
            var serializationModeType = xamlUtilities.GetType("WotC.XAMLUtilities.SerializationMode", true);

            return new AdventureToolsAssemblies
            {
                Core = core,
                Monsters = monsters,
                XamlUtilities = xamlUtilities,
                MonstersViewModel = monstersViewModel,
                MonsterType = monsters.GetType("AdventureTools.Monsters.Monster", true),
                MonsterDataType = monsters.GetType("AdventureTools.Monsters.MonsterData", true),
                CoreDataType = core.GetType("AdventureTools.Core.CoreData", true),
                ModelRootsType = xamlUtilities.GetType("WotC.XAMLUtilities.ModelRoots", true),
                ModelRootType = xamlUtilities.GetType("WotC.XAMLUtilities.ModelRoot", true),
                DataSerializerType = xamlUtilities.GetType("WotC.XAMLUtilities.DataSerializer", true),
                SerializationModeType = serializationModeType,
                DataStoreFileStreamSourceType = xamlUtilities.GetType(
                    "WotC.XAMLUtilities.DataStoreFileStreamSource",
                    true),
                EncryptedFileStreamLoaderType = monstersViewModel.GetType(
                    "ApplicationUpdate.Client.EncryptedFileStreamLoader",
                    true),
                NewFormatListLoaderType = monsters.GetType("AdventureTools.Monsters.NewFormatListLoader", true),
                CurrentListLoaderType = monsters.GetType("AdventureTools.Monsters.CurrentListLoader", true),
                BetaListLoaderType = monsters.GetType("AdventureTools.Monsters.BetaListLoader", true),
                ListLoaderType = xamlUtilities.GetType("WotC.XAMLUtilities.ListLoader", true),
                IStreamSourceType = xamlUtilities.GetType("WotC.XAMLUtilities.IStreamSource", true),
                ExportAllMode = Enum.Parse(serializationModeType, "ExportAll"),
            };
        }

        private static Assembly OnAssemblyResolve(object sender, ResolveEventArgs args)
        {
            var name = new AssemblyName(args.Name).Name + ".dll";
            var path = Path.Combine(_adventureToolsDir, name);
            return File.Exists(path) ? Assembly.LoadFrom(path) : null;
        }
    }

    internal sealed class AdventureToolsRuntime
    {
        private readonly AdventureToolsAssemblies _assemblies;
        private readonly object _monsterModelRoot;
        private readonly object _importExportLoader;
        private readonly MethodInfo _loadBody;
        private readonly MethodInfo _executeSerializationSession;
        private readonly MethodInfo _serializeObject;
        private readonly PropertyInfo _monstersProperty;
        private readonly PropertyInfo _monsterNameProperty;
        private readonly PropertyInfo _monsterIdProperty;

        private AdventureToolsRuntime(
            AdventureToolsAssemblies assemblies,
            object monsterModelRoot,
            object importExportLoader,
            MethodInfo loadBody,
            MethodInfo executeSerializationSession,
            MethodInfo serializeObject,
            PropertyInfo monstersProperty,
            PropertyInfo monsterNameProperty,
            PropertyInfo monsterIdProperty)
        {
            _assemblies = assemblies;
            _monsterModelRoot = monsterModelRoot;
            _importExportLoader = importExportLoader;
            _loadBody = loadBody;
            _executeSerializationSession = executeSerializationSession;
            _serializeObject = serializeObject;
            _monstersProperty = monstersProperty;
            _monsterNameProperty = monsterNameProperty;
            _monsterIdProperty = monsterIdProperty;
        }

        public static AdventureToolsRuntime Create(
            AdventureToolsAssemblies assemblies,
            string dataRootDir,
            string applicationId)
        {
            var streamSource = CreateEncryptedStreamSource(assemblies, applicationId);
            var importExportLoader = CreateImportExportLoader(assemblies, streamSource);

            ConfigureModelRoot(assemblies, assemblies.CoreDataType, dataRootDir, streamSource, importExportLoader);
            var monsterModelRoot = ConfigureModelRoot(
                assemblies,
                assemblies.MonsterDataType,
                dataRootDir,
                streamSource,
                importExportLoader);

            ReloadOfficialData(assemblies, monsterModelRoot);

            var modelRootType = assemblies.ModelRootType;
            var loadBody = modelRootType.GetMethod("LoadBody", BindingFlags.Public | BindingFlags.Instance);
            if (loadBody == null)
            {
                throw new InvalidOperationException("ModelRoot.LoadBody not found.");
            }

            var executeSerializationSession = assemblies.DataSerializerType.GetMethods(BindingFlags.Public | BindingFlags.Static)
                .First(m => m.Name == "ExecuteSerializationSession" && m.GetParameters().Length == 6);
            var serializeObject = assemblies.DataSerializerType.GetMethod(
                "SerializeObject",
                BindingFlags.Public | BindingFlags.Static);

            var monstersProperty = assemblies.MonsterDataType.GetProperty("Monsters");
            if (monstersProperty == null)
            {
                throw new InvalidOperationException("MonsterData.Monsters property not found.");
            }

            var monsterNameProperty = assemblies.MonsterType.GetProperty("Name");
            if (monsterNameProperty == null)
            {
                throw new InvalidOperationException("Monster.Name property not found.");
            }

            var monsterIdProperty = assemblies.MonsterType.GetProperty("ID")
                ?? assemblies.MonsterType.GetProperty("Id");
            if (monsterIdProperty == null)
            {
                throw new InvalidOperationException("Monster ID property not found.");
            }

            return new AdventureToolsRuntime(
                assemblies,
                monsterModelRoot,
                importExportLoader,
                loadBody,
                executeSerializationSession,
                serializeObject,
                monstersProperty,
                monsterNameProperty,
                monsterIdProperty);
        }

        public IList GetMonsters()
        {
            return (IList)_monstersProperty.GetValue(_monsterModelRoot, null);
        }

        public string GetMonsterName(object monster)
        {
            var value = Convert.ToString(_monsterNameProperty.GetValue(monster, null));
            return string.IsNullOrWhiteSpace(value) ? "monster" : value.Trim();
        }

        public string GetMonsterId(object monster)
        {
            var value = Convert.ToString(_monsterIdProperty.GetValue(monster, null));
            return string.IsNullOrWhiteSpace(value) ? string.Empty : value.Trim();
        }

        public void LoadBody(object monster)
        {
            _loadBody.Invoke(_monsterModelRoot, new[] { monster });
        }

        public string ExportMonsterXml(object monster)
        {
            var writerSettings = new XmlWriterSettings
            {
                Indent = true,
                OmitXmlDeclaration = false,
                Encoding = Encoding.UTF8,
            };

            var buffer = new StringWriter();
            using (var writer = XmlWriter.Create(buffer, writerSettings))
            {
                var action = (Action)delegate
                {
                    _serializeObject.Invoke(
                        null,
                        new[] { writer, monster, "Monster", _assemblies.MonsterType });
                };

                _executeSerializationSession.Invoke(
                    null,
                    new[]
                    {
                        _monsterModelRoot,
                        _importExportLoader,
                        "Monster",
                        true,
                        _assemblies.ExportAllMode,
                        action,
                    });
            }

            var xml = buffer.ToString();
            if (string.IsNullOrWhiteSpace(xml) || xml.Length < 500)
            {
                throw new InvalidOperationException("Export produced empty or incomplete monster XML.");
            }

            return xml;
        }

        private static object ConfigureModelRoot(
            AdventureToolsAssemblies assemblies,
            Type modelDataType,
            string dataRootDir,
            object streamSource,
            object importExportLoader)
        {
            var modelRoot = GetModelRoot(assemblies, modelDataType);
            var defaultConfig = assemblies.ModelRootType
                .GetProperty("DefaultConfig", BindingFlags.Public | BindingFlags.Instance)
                .GetValue(modelRoot, null);

            SetProperty(defaultConfig, "DataRoot", dataRootDir);
            SetProperty(defaultConfig, "StreamSource", streamSource);
            SetProperty(defaultConfig, "ImportExportListLoader", importExportLoader);
            SetProperty(defaultConfig, "TreatAllAsOfficial", true);
            SetProperty(defaultConfig, "LoadInitialData", true);

            return modelRoot;
        }

        private static void ReloadOfficialData(AdventureToolsAssemblies assemblies, object monsterModelRoot)
        {
            assemblies.ModelRootType
                .GetMethod("FlushData", BindingFlags.Public | BindingFlags.Instance)
                .Invoke(monsterModelRoot, null);

            var getData = assemblies.ModelRootType
                .GetMethods(BindingFlags.Public | BindingFlags.Instance)
                .First(m => m.Name == "GetData" && m.IsGenericMethodDefinition && m.GetParameters().Length == 0)
                .MakeGenericMethod(assemblies.MonsterType);

            getData.Invoke(monsterModelRoot, null);
        }

        private static object GetModelRoot(AdventureToolsAssemblies assemblies, Type modelDataType)
        {
            return assemblies.ModelRootsType
                .GetMethod("GetModelRoot", BindingFlags.Public | BindingFlags.Static)
                .Invoke(null, new object[] { modelDataType });
        }

        private static object CreateImportExportLoader(AdventureToolsAssemblies assemblies, object streamSource)
        {
            var beta = Activator.CreateInstance(assemblies.BetaListLoaderType);
            var current = Activator.CreateInstance(assemblies.CurrentListLoaderType);
            var importExport = Activator.CreateInstance(assemblies.NewFormatListLoaderType);

            SetProperty(beta, "StreamSource", streamSource);
            SetProperty(current, "StreamSource", streamSource);
            SetProperty(importExport, "StreamSource", streamSource);
            SetProperty(current, "NextLoader", beta);
            SetProperty(importExport, "NextLoader", current);

            return importExport;
        }

        private static object CreateEncryptedStreamSource(AdventureToolsAssemblies assemblies, string applicationId)
        {
            var plain = Activator.CreateInstance(assemblies.DataStoreFileStreamSourceType);
            SetProperty(plain, "BaseFilePath", "Data");
            SetProperty(plain, "Extension", ".data");

            var encryptedCtor = assemblies.EncryptedFileStreamLoaderType.GetConstructor(
                new[] { typeof(Guid), assemblies.IStreamSourceType });
            if (encryptedCtor == null)
            {
                return plain;
            }

            return encryptedCtor.Invoke(new object[] { Guid.Parse(applicationId), plain });
        }

        private static void SetProperty(object target, string propertyName, object value)
        {
            var property = target.GetType().GetProperty(propertyName, BindingFlags.Public | BindingFlags.Instance);
            if (property == null || !property.CanWrite)
            {
                throw new InvalidOperationException(
                    "Property " + propertyName + " is not writable on " + target.GetType().FullName);
            }

            property.SetValue(target, value, null);
        }
    }
}
