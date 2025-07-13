# Panduan Implementasi Website PHP dengan API Key dan Token Login

## Deskripsi
Panduan ini menjelaskan cara membuat website PHP yang menggunakan API key dan token login untuk mengakses API Todo. Website ini akan terhubung ke database MySQL melalui phpMyAdmin dan memiliki kemampuan CRUD (Create, Read, Update, Delete) untuk mengelola data tugas dan kategori.

## Fitur Utama
- Autentikasi dengan JWT Token dan API Key
- Koneksi ke database MySQL melalui phpMyAdmin
- Operasi CRUD untuk tugas dan kategori
- Manajemen pengguna (registrasi, login, profil)
- Antarmuka yang responsif dan user-friendly

## Persyaratan
- PHP 7.4 atau lebih tinggi
- MySQL 5.7 atau lebih tinggi
- XAMPP/WAMP/LAMP stack
- Web browser modern
- Koneksi internet (untuk mengakses library eksternal)

## Struktur Folder
```
website/
├── api/
│   ├── config/
│   │   └── database.php
│   ├── controllers/
│   ├── models/
│   └── utils/
├── assets/
│   ├── css/
│   ├── js/
│   └── img/
├── includes/
│   ├── header.php
│   ├── footer.php
│   └── functions.php
├── pages/
│   ├── login.php
│   ├── register.php
│   ├── dashboard.php
│   ├── tasks.php
│   └── categories.php
├── index.php
└── config.php
```

## Langkah-langkah Implementasi

### 1. Konfigurasi Database

Buat file `config/database.php` untuk mengelola koneksi database:

```php
<?php
class Database {
    private $host = "localhost";
    private $db_name = "todolist";
    private $username = "root";
    private $password = "";
    private $conn;

    // Metode untuk koneksi ke database
    public function getConnection() {
        $this->conn = null;

        try {
            $this->conn = new PDO("mysql:host=" . $this->host . ";dbname=" . $this->db_name, $this->username, $this->password);
            $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        } catch(PDOException $e) {
            echo "Koneksi gagal: " . $e->getMessage();
        }

        return $this->conn;
    }
}
?>
```

### 2. Implementasi Autentikasi dengan API Key

Buat file `includes/functions.php` untuk mengelola API key dan token:

```php
<?php
// Fungsi untuk menyimpan API key dan token di session
function saveAuthData($apiKey, $token, $userData) {
    $_SESSION['api_key'] = $apiKey;
    $_SESSION['token'] = $token;
    $_SESSION['user'] = $userData;
}

// Fungsi untuk mengecek apakah user sudah login
function isLoggedIn() {
    return isset($_SESSION['api_key']) && isset($_SESSION['token']);
}

// Fungsi untuk melakukan request ke API dengan API key
function apiRequestWithKey($endpoint, $method = 'GET', $data = null) {
    $apiBaseUrl = "http://localhost:3000/api";
    $url = $apiBaseUrl . $endpoint;
    
    $curl = curl_init();
    
    $headers = [
        "X-API-Key: " . $_SESSION['api_key'],
        "Content-Type: application/json"
    ];
    
    $options = [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_CUSTOMREQUEST => $method
    ];
    
    if ($data && ($method === 'POST' || $method === 'PUT' || $method === 'PATCH')) {
        $options[CURLOPT_POSTFIELDS] = json_encode($data);
    }
    
    curl_setopt_array($curl, $options);
    
    $response = curl_exec($curl);
    $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    
    curl_close($curl);
    
    return [
        'code' => $httpCode,
        'data' => json_decode($response, true)
    ];
}

// Fungsi untuk melakukan request ke API dengan token JWT
function apiRequestWithToken($endpoint, $method = 'GET', $data = null) {
    $apiBaseUrl = "http://localhost:3000/api";
    $url = $apiBaseUrl . $endpoint;
    
    $curl = curl_init();
    
    $headers = [
        "Authorization: Bearer " . $_SESSION['token'],
        "Content-Type: application/json"
    ];
    
    $options = [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_CUSTOMREQUEST => $method
    ];
    
    if ($data && ($method === 'POST' || $method === 'PUT' || $method === 'PATCH')) {
        $options[CURLOPT_POSTFIELDS] = json_encode($data);
    }
    
    curl_setopt_array($curl, $options);
    
    $response = curl_exec($curl);
    $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    
    curl_close($curl);
    
    return [
        'code' => $httpCode,
        'data' => json_decode($response, true)
    ];
}
?>
```

### 3. Halaman Login

Buat file `pages/login.php` untuk halaman login:

```php
<?php
session_start();
require_once 'includes/functions.php';

$error = '';

// Jika user sudah login, redirect ke dashboard
if (isLoggedIn()) {
    header('Location: dashboard.php');
    exit;
}

// Proses login
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = $_POST['email'] ?? '';
    $password = $_POST['password'] ?? '';
    
    if (empty($email) || empty($password)) {
        $error = 'Email dan password harus diisi';
    } else {
        // Request ke API untuk login
        $apiBaseUrl = "http://localhost:3000/api";
        $url = $apiBaseUrl . "/users/login";
        
        $curl = curl_init();
        
        $data = [
            'email' => $email,
            'password' => $password
        ];
        
        curl_setopt_array($curl, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($data),
            CURLOPT_HTTPHEADER => [
                "Content-Type: application/json"
            ]
        ]);
        
        $response = curl_exec($curl);
        $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        
        curl_close($curl);
        
        $responseData = json_decode($response, true);
        
        if ($httpCode === 200 && $responseData['success']) {
            // Simpan API key dan token di session
            $apiKey = $responseData['data']['user']['api_key'];
            $token = $responseData['data']['token'];
            $userData = $responseData['data']['user'];
            
            saveAuthData($apiKey, $token, $userData);
            
            header('Location: dashboard.php');
            exit;
        } else {
            $error = $responseData['message'] ?? 'Login gagal';
        }
    }
}
?>

<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - Todo App</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
</head>
<body>
    <div class="container mt-5">
        <div class="row justify-content-center">
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header bg-primary text-white">
                        <h4 class="mb-0">Login</h4>
                    </div>
                    <div class="card-body">
                        <?php if ($error): ?>
                            <div class="alert alert-danger"><?php echo $error; ?></div>
                        <?php endif; ?>
                        
                        <form method="post" action="">
                            <div class="mb-3">
                                <label for="email" class="form-label">Email</label>
                                <input type="email" class="form-control" id="email" name="email" required>
                            </div>
                            <div class="mb-3">
                                <label for="password" class="form-label">Password</label>
                                <input type="password" class="form-control" id="password" name="password" required>
                            </div>
                            <div class="d-grid gap-2">
                                <button type="submit" class="btn btn-primary">Login</button>
                            </div>
                        </form>
                        
                        <div class="mt-3 text-center">
                            <p>Belum punya akun? <a href="register.php">Daftar disini</a></p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
```

### 4. Halaman Dashboard dengan CRUD

Buat file `pages/dashboard.php` untuk menampilkan dan mengelola tugas:

```php
<?php
session_start();
require_once 'includes/functions.php';

// Cek apakah user sudah login
if (!isLoggedIn()) {
    header('Location: login.php');
    exit;
}

// Ambil data kategori menggunakan API key
$categoriesResponse = apiRequestWithKey('/key/categories');
$categories = [];

if ($categoriesResponse['code'] === 200 && $categoriesResponse['data']['success']) {
    $categories = $categoriesResponse['data']['data']['categories'] ?? [];
}

// Ambil data tugas menggunakan API key
$tasksResponse = apiRequestWithKey('/key/tasks');
$tasks = [];
$pagination = null;

if ($tasksResponse['code'] === 200 && $tasksResponse['data']['success']) {
    $tasks = $tasksResponse['data']['data']['tasks'] ?? [];
    $pagination = $tasksResponse['data']['pagination'] ?? null;
}

// Proses tambah tugas baru
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'add_task') {
    $title = $_POST['title'] ?? '';
    $description = $_POST['description'] ?? '';
    $priority = $_POST['priority'] ?? 'medium';
    $category_id = !empty($_POST['category_id']) ? (int)$_POST['category_id'] : null;
    $due_date = !empty($_POST['due_date']) ? $_POST['due_date'] : null;
    
    $taskData = [
        'title' => $title,
        'description' => $description,
        'priority' => $priority,
        'category_id' => $category_id,
        'due_date' => $due_date
    ];
    
    $response = apiRequestWithKey('/key/tasks', 'POST', $taskData);
    
    // Redirect untuk refresh halaman
    header('Location: dashboard.php');
    exit;
}

// Proses update status tugas
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'update_status') {
    $task_id = (int)$_POST['task_id'];
    $status = $_POST['status'];
    
    $response = apiRequestWithKey("/key/tasks/{$task_id}/status", 'PATCH', [
        'status' => $status
    ]);
    
    // Redirect untuk refresh halaman
    header('Location: dashboard.php');
    exit;
}

// Proses hapus tugas
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'delete_task') {
    $task_id = (int)$_POST['task_id'];
    
    $response = apiRequestWithKey("/key/tasks/{$task_id}", 'DELETE');
    
    // Redirect untuk refresh halaman
    header('Location: dashboard.php');
    exit;
}
?>

<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - Todo App</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css">
</head>
<body>
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
        <div class="container">
            <a class="navbar-brand" href="#">Todo App</a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav me-auto">
                    <li class="nav-item">
                        <a class="nav-link active" href="dashboard.php">Dashboard</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="categories.php">Kategori</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="profile.php">Profil</a>
                    </li>
                </ul>
                <ul class="navbar-nav">
                    <li class="nav-item">
                        <a class="nav-link" href="logout.php">Logout</a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>
    
    <div class="container mt-4">
        <div class="row mb-4">
            <div class="col-md-12">
                <div class="card">
                    <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                        <h5 class="mb-0">Tambah Tugas Baru</h5>
                    </div>
                    <div class="card-body">
                        <form method="post" action="">
                            <input type="hidden" name="action" value="add_task">
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label for="title" class="form-label">Judul</label>
                                    <input type="text" class="form-control" id="title" name="title" required>
                                </div>
                                <div class="col-md-3 mb-3">
                                    <label for="priority" class="form-label">Prioritas</label>
                                    <select class="form-select" id="priority" name="priority">
                                        <option value="low">Rendah</option>
                                        <option value="medium" selected>Sedang</option>
                                        <option value="high">Tinggi</option>
                                    </select>
                                </div>
                                <div class="col-md-3 mb-3">
                                    <label for="category_id" class="form-label">Kategori</label>
                                    <select class="form-select" id="category_id" name="category_id">
                                        <option value="">Pilih Kategori</option>
                                        <?php foreach ($categories as $category): ?>
                                            <option value="<?php echo $category['id']; ?>">
                                                <?php echo htmlspecialchars($category['name']); ?>
                                            </option>
                                        <?php endforeach; ?>
                                    </select>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-9 mb-3">
                                    <label for="description" class="form-label">Deskripsi</label>
                                    <textarea class="form-control" id="description" name="description" rows="3"></textarea>
                                </div>
                                <div class="col-md-3 mb-3">
                                    <label for="due_date" class="form-label">Tenggat Waktu</label>
                                    <input type="date" class="form-control" id="due_date" name="due_date">
                                </div>
                            </div>
                            <div class="d-grid gap-2">
                                <button type="submit" class="btn btn-primary">Tambah Tugas</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="row">
            <div class="col-md-12">
                <div class="card">
                    <div class="card-header bg-primary text-white">
                        <h5 class="mb-0">Daftar Tugas</h5>
                    </div>
                    <div class="card-body">
                        <?php if (empty($tasks)): ?>
                            <div class="alert alert-info">Belum ada tugas. Tambahkan tugas baru!</div>
                        <?php else: ?>
                            <div class="table-responsive">
                                <table class="table table-hover">
                                    <thead>
                                        <tr>
                                            <th>Judul</th>
                                            <th>Kategori</th>
                                            <th>Prioritas</th>
                                            <th>Status</th>
                                            <th>Tenggat</th>
                                            <th>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php foreach ($tasks as $task): ?>
                                            <tr>
                                                <td><?php echo htmlspecialchars($task['title']); ?></td>
                                                <td>
                                                    <?php 
                                                    if (!empty($task['category'])) {
                                                        echo '<span class="badge" style="background-color: ' . htmlspecialchars($task['category']['color']) . '">';
                                                        echo htmlspecialchars($task['category']['name']);
                                                        echo '</span>';
                                                    } else {
                                                        echo '<span class="text-muted">-</span>';
                                                    }
                                                    ?>
                                                </td>
                                                <td>
                                                    <?php 
                                                    $priorityBadge = 'bg-info';
                                                    if ($task['priority'] === 'high') $priorityBadge = 'bg-danger';
                                                    if ($task['priority'] === 'low') $priorityBadge = 'bg-success';
                                                    echo '<span class="badge ' . $priorityBadge . '">' . ucfirst($task['priority']) . '</span>';
                                                    ?>
                                                </td>
                                                <td>
                                                    <form method="post" action="" class="d-inline">
                                                        <input type="hidden" name="action" value="update_status">
                                                        <input type="hidden" name="task_id" value="<?php echo $task['id']; ?>">
                                                        <input type="hidden" name="status" value="<?php echo $task['status'] === 'pending' ? 'completed' : 'pending'; ?>">
                                                        <button type="submit" class="btn btn-sm <?php echo $task['status'] === 'completed' ? 'btn-success' : 'btn-outline-success'; ?>">
                                                            <i class="bi bi-check-circle"></i>
                                                        </button>
                                                    </form>
                                                </td>
                                                <td>
                                                    <?php 
                                                    if (!empty($task['due_date'])) {
                                                        echo date('d M Y', strtotime($task['due_date']));
                                                    } else {
                                                        echo '<span class="text-muted">-</span>';
                                                    }
                                                    ?>
                                                </td>
                                                <td>
                                                    <a href="edit_task.php?id=<?php echo $task['id']; ?>" class="btn btn-sm btn-primary">
                                                        <i class="bi bi-pencil"></i>
                                                    </a>
                                                    <form method="post" action="" class="d-inline" onsubmit="return confirm('Yakin ingin menghapus tugas ini?')">
                                                        <input type="hidden" name="action" value="delete_task">
                                                        <input type="hidden" name="task_id" value="<?php echo $task['id']; ?>">
                                                        <button type="submit" class="btn btn-sm btn-danger">
                                                            <i class="bi bi-trash"></i>
                                                        </button>
                                                    </form>
                                                </td>
                                            </tr>
                                        <?php endforeach; ?>
                                    </tbody>
                                </table>
                            </div>
                        <?php endif; ?>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
```

## Prompt untuk AI

Berikut adalah prompt yang dapat Anda gunakan untuk membuat website PHP dengan API key dan token login menggunakan AI:

```
Buatkan saya kode untuk website PHP yang menggunakan API key dan token login untuk mengakses API Todo. Website ini harus memiliki fitur-fitur berikut:

1. Koneksi ke database MySQL melalui phpMyAdmin
2. Sistem autentikasi dengan JWT token dan API key
3. Halaman login dan registrasi
4. Dashboard untuk menampilkan tugas
5. Kemampuan CRUD (Create, Read, Update, Delete) untuk tugas dan kategori
6. Tampilan yang responsif menggunakan Bootstrap

API Todo sudah tersedia dengan endpoint berikut:
- Login: POST /api/users/login
- Register: POST /api/users/register
- Get Tasks: GET /api/key/tasks (dengan header X-API-Key)
- Create Task: POST /api/key/tasks (dengan header X-API-Key)
- Update Task: PUT /api/key/tasks/{id} (dengan header X-API-Key)
- Delete Task: DELETE /api/key/tasks/{id} (dengan header X-API-Key)

Tolong berikan struktur folder yang jelas dan kode lengkap untuk file-file utama seperti koneksi database, fungsi autentikasi, halaman login, dan dashboard.
```

## Kesimpulan

Dengan mengikuti panduan ini, Anda dapat membuat website PHP yang terintegrasi dengan API Todo menggunakan API key dan token login. Website ini akan memiliki kemampuan CRUD untuk mengelola tugas dan kategori, serta terhubung ke database MySQL melalui phpMyAdmin.

Beberapa poin penting yang perlu diperhatikan:

1. Pastikan API Todo berjalan dan dapat diakses dari website PHP
2. Simpan API key dan token dengan aman di session
3. Gunakan prepared statements untuk mencegah SQL injection
4. Validasi input pengguna untuk mencegah XSS dan serangan lainnya
5. Implementasikan error handling yang baik untuk pengalaman pengguna yang lebih baik

Dengan mengimplementasikan website ini, Anda akan memiliki aplikasi Todo yang lengkap dengan backend API dan frontend website yang dapat diakses melalui browser.