import React, { useState } from 'react';
import {
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  TextField,
  ThemeProvider,
  Toolbar,
  Typography,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import HomeIcon from '@mui/icons-material/Home';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import { lightTheme } from '../utils/theme';
import '../styles/material-theme.css';

const MaterialDesignSample = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleDialogToggle = () => {
    setDialogOpen(!dialogOpen);
  };

  return (
    <ThemeProvider theme={lightTheme}>
      <Box sx={{ flexGrow: 1 }}>
        {/* App Bar */}
        <AppBar position="static" color="primary">
          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              aria-label="menu"
              onClick={handleDrawerToggle}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Material Design M3 샘플
            </Typography>
            <Button color="inherit">로그인</Button>
          </Toolbar>
        </AppBar>

        {/* Drawer */}
        <Drawer
          anchor="left"
          open={drawerOpen}
          onClose={handleDrawerToggle}
        >
          <List sx={{ width: 250 }}>
            <ListItem button>
              <ListItemIcon>
                <HomeIcon />
              </ListItemIcon>
              <ListItemText primary="홈" />
            </ListItem>
            <ListItem button>
              <ListItemIcon>
                <PersonIcon />
              </ListItemIcon>
              <ListItemText primary="프로필" />
            </ListItem>
            <ListItem button>
              <ListItemIcon>
                <SettingsIcon />
              </ListItemIcon>
              <ListItemText primary="설정" />
            </ListItem>
          </List>
        </Drawer>

        {/* Main Content */}
        <Container maxWidth="md" sx={{ mt: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            환영합니다!
          </Typography>

          {/* Cards */}
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', my: 4 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  기본 카드
                </Typography>
                <Typography variant="body1">
                  Material Design M3의 카드 컴포넌트 예시입니다.
                </Typography>
                <Button
                  variant="contained"
                  color="primary"
                  sx={{ mt: 2 }}
                  onClick={handleDialogToggle}
                >
                  자세히 보기
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  입력 폼
                </Typography>
                <TextField
                  fullWidth
                  label="이메일"
                  variant="outlined"
                  margin="normal"
                />
                <TextField
                  fullWidth
                  label="비밀번호"
                  type="password"
                  variant="outlined"
                  margin="normal"
                />
                <Button
                  variant="contained"
                  color="secondary"
                  fullWidth
                  sx={{ mt: 2 }}
                >
                  제출하기
                </Button>
              </CardContent>
            </Card>
          </Box>

          {/* Button Variants */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', my: 4 }}>
            <Button variant="contained" color="primary">
              Primary
            </Button>
            <Button variant="contained" color="secondary">
              Secondary
            </Button>
            <Button variant="outlined" color="primary">
              Outlined
            </Button>
            <Button variant="text" color="primary">
              Text
            </Button>
          </Box>
        </Container>

        {/* Dialog */}
        <Dialog open={dialogOpen} onClose={handleDialogToggle}>
          <DialogTitle>상세 정보</DialogTitle>
          <DialogContent>
            <Typography>
              이것은 Material Design M3 스타일의 다이얼로그입니다.
              모서리가 둥글고 그림자 효과가 적용되어 있습니다.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDialogToggle}>닫기</Button>
            <Button variant="contained" onClick={handleDialogToggle} autoFocus>
              확인
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
};

export default MaterialDesignSample;
